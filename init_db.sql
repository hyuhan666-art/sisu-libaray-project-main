-- ============================================================================
-- 图书馆管理系统 - 数据库建库脚本 (MySQL 8.0)
-- ============================================================================
-- 说明：
--   1. 数据库字符集统一使用 utf8mb4，排序规则 utf8mb4_unicode_ci
--   2. 所有表使用 InnoDB 引擎以支持事务和外键
--   3. 涉及金额的字段使用 decimal(10,2)，确保精度
--   4. 所有时间字段使用 datetime 类型，默认 current_timestamp
-- ============================================================================

-- 创建数据库（库名含连字符，必须用反引号包裹）
create database `sisu-library`
    default charset utf8mb4
    collate utf8mb4_unicode_ci;

use `sisu-library`;


-- ============================================================================
-- 1. 用户表 (user)
--    存储系统中所有用户：读者、图书管理员、系统管理员
--    通过 role 枚举字段区分用户角色
-- ============================================================================
create table user(
    id int primary key auto_increment comment '用户id',
    username varchar(20) not null comment '用户名',
    password_hash varchar(255) not null comment '密码',
    email varchar(50) not null comment '邮箱',
    real_name varchar(20) not null comment '真实姓名',
    phone varchar(20) not null comment '电话',
    role enum('librarian', 'reader', 'admin') not null default 'reader' comment '角色',
    is_active boolean not null default true comment '是否激活',
    created_at datetime not null default current_timestamp comment '创建时间',
    updated_at datetime not null default current_timestamp on update current_timestamp comment '更新时间'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='用户表';


-- ============================================================================
-- 2. 读者卡表 (reader_card)
--    每个读者用户对应一张读者卡，用于借阅管理
--    与 user 表一对一关联（user_id 唯一约束）
-- ============================================================================
create table reader_card(
    id int primary key auto_increment comment '读者卡号',
    user_id int not null unique comment '用户id',
    card_number varchar(20) not null unique comment '卡号',
    max_borrow_limit int not null default 5 comment '最大借阅数量',
    current_borrow_count int not null default 0 comment '当前借阅数量',
    expire_date date not null comment '过期时间',
    status varchar(20) not null default 'active' comment '状态',
    created_at datetime not null default current_timestamp comment '创建时间',

    foreign key (user_id) references user(id) on delete cascade,
    index idx_card_number(card_number) comment '卡号索引'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='读者卡表';


-- ============================================================================
-- 3. 分类表 (category)
--    图书分类，支持多级分类（通过 parent_id 自引用实现树形结构）
--    parent_id 为 null 表示一级分类
-- ============================================================================
create table category(
    id int primary key auto_increment comment '分类ID',
    name varchar(50) not null comment '分类名称',
    parent_id int default null comment '父级分类ID',
    description varchar(200) default null comment '描述',
    created_at datetime not null default current_timestamp comment '创建时间',

    foreign key (parent_id) references category(id) on delete set null,
    index idx_name(name) comment '名称索引',
    index idx_parent_id(parent_id) comment '父级分类ID索引'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='分类表';


-- ============================================================================
-- 4. 图书表 (book)
--    存储图书元信息（ISBN、书名、作者等）
--    每本书记录 total_copies（副本总数）和 available_copies（可借数量）
--    注意：这两个字段由触发器自动维护，不应手动修改
-- ============================================================================
create table book(
    id int primary key auto_increment comment '图书ID',
    isbn varchar(20) not null unique comment 'ISBN',
    title varchar(200) not null comment '书名',
    author varchar(100) not null comment '作者',
    publisher varchar(100) not null comment '出版社',
    publish_date date not null comment '出版日期',
    category_id int comment '分类ID',
    description text comment '描述',
    cover_url varchar(500) comment '封面URL',
    language varchar(20) not null default '中文' comment '语言',
    price decimal(10,2) not null comment '价格',
    total_copies int not null default 0 comment '总数量（副本总数）',
    available_copies int not null default 0 comment '可用数量（副本在馆数量）',
    created_at datetime not null default current_timestamp comment '创建时间',
    updated_at datetime not null default current_timestamp on update current_timestamp comment '更新时间',

    foreign key (category_id) references category(id) on delete set null,
    index idx_isbn(isbn) comment 'ISBN索引',
    index idx_title(title) comment '书名索引',
    index idx_author(author) comment '作者索引',
    index idx_category(category_id) comment '分类ID索引'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='图书表';


-- ============================================================================
-- 5. 图书副本表 (book_copies)
--    每本图书可以有多个物理副本，每个副本有独立的条形码和状态
--    状态流转：available → borrowed → returned → available（正常循环）
--             available → damaged / lost / scrapped（异常终态）
-- ============================================================================
create table book_copies(
    id int primary key auto_increment comment '图书副本ID',
    book_id int not null comment '图书ID',
    barcode varchar(20) not null unique comment '条形码',
    status enum('available', 'borrowed', 'reserved', 'damaged', 'lost', 'scrapped') not null default 'available' comment '状态',
    location varchar(100) comment '位置',
    purchase_date date comment '购买日期',
    created_at datetime not null default current_timestamp comment '创建时间',

    foreign key (book_id) references book(id) on delete cascade,
    index idx_barcode(barcode) comment '条形码索引',
    index idx_book_id(book_id) comment '图书ID索引',
    index idx_status(status) comment '状态索引'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='图书副本表';


-- ============================================================================
-- 6. 预约表 (reservation)
--    读者对已被借出的图书进行预约排队
--    状态流转：pending → active → expired（到期自动失效）/ cancelled（取消）
-- ============================================================================
create table reservation(
    id int primary key auto_increment comment '预约ID',
    user_id int not null comment '用户ID',
    book_id int not null comment '图书ID',
    reserve_date datetime not null default current_timestamp comment '预约日期',
    expire_date datetime not null comment '过期日期',
    status enum('pending', 'active', 'expired', 'cancelled') not null default 'pending' comment '状态',
    created_at datetime not null default current_timestamp comment '创建时间',

    foreign key (user_id) references user(id) on delete cascade,
    foreign key (book_id) references book(id) on delete cascade,
    index idx_user_id(user_id) comment '用户ID索引',
    index idx_book_id(book_id) comment '图书ID索引',
    index idx_status(status) comment '状态索引'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='预约表';


-- ============================================================================
-- 7. 借阅记录表 (borrowrecord)
--    核心业务表，记录每一次借阅操作
--    renewed_times 记录已续借次数，剩余次数 = max_renew_times - renewed_times
--    状态流转：borrowing → renewed（续借）/ overdue（逾期）/ returned（归还）
-- ============================================================================
create table borrowrecord(
    id int primary key auto_increment comment '借阅记录ID',
    read_card_id int not null comment '读者卡ID',
    book_copy_id int not null comment '图书副本ID',
    librarian_id int not null comment '图书管理员ID',
    borrow_date datetime not null default current_timestamp comment '借阅日期',
    due_date datetime not null comment '到期日期',
    return_date datetime comment '归还日期',
    return_librarian_id int comment '归还图书管理员ID',
    renewed_times int not null default 0 comment '已续借次数（剩余续借次数 = max_renew_times - renewed_times）',
    max_renew_times int not null default 2 comment '最大续借次数',
    status enum('borrowing', 'returned', 'overdue', 'renewed') not null default 'borrowing' comment '状态',
    overdue_fee numeric(10,2) not null default 0 comment '逾期费用',
    notes varchar(500) comment '备注',
    created_at datetime not null default current_timestamp comment '创建时间',

    foreign key (read_card_id) references reader_card(id) on delete cascade,
    foreign key (book_copy_id) references book_copies(id) on delete cascade,
    foreign key (librarian_id) references user(id) on delete cascade,
    foreign key (return_librarian_id) references user(id) on delete set null,
    index idx_read_card_id(read_card_id) comment '读者卡ID索引',
    index idx_book_copy_id(book_copy_id) comment '图书副本ID索引',
    index idx_librarian_id(librarian_id) comment '图书管理员ID索引',
    index idx_return_librarian_id(return_librarian_id) comment '归还图书管理员ID索引',
    index idx_status(status) comment '状态索引'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='借阅记录表';


-- ============================================================================
-- 8. 库存记录表 (inventoryrecord)
--    记录所有图书副本的库存变动操作（入库、盘点、损坏、报废、丢失、借出、归还）
--    是图书副本全生命周期追踪的审计日志
-- ============================================================================
create table inventoryrecord(
    id int primary key auto_increment comment '库存记录ID',
    book_copy_id int not null comment '图书副本ID',
    operator_id int not null comment '操作员ID',
    operation_type enum('stock_in', 'inventory_check', 'damaged', 'scrapped', 'lost', 'borrowed', 'returned') not null comment '操作类型',
    operation_date datetime not null default current_timestamp comment '操作日期',
    notes varchar(500) comment '备注',
    created_at datetime not null default current_timestamp comment '创建时间',

    foreign key (book_copy_id) references book_copies(id) on delete cascade,
    foreign key (operator_id) references user(id) on delete cascade,
    index idx_book_copy_id(book_copy_id) comment '图书副本ID索引',
    index idx_operator_id(operator_id) comment '操作员ID索引'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='库存记录表';


-- ============================================================================
-- 9. 系统配置表 (system_config)
--    键值对形式的系统配置，如借阅天数、逾期费率等
-- ============================================================================
create table system_config(
    id int primary key auto_increment comment '配置ID',
    setting_key varchar(50) not null unique comment '配置键',
    setting_value varchar(200) not null comment '配置值',
    description varchar(500) comment '描述',
    updated_at datetime not null default current_timestamp on update current_timestamp comment '更新时间',
    updated_by int comment '更新者ID',

    foreign key (updated_by) references user(id),
    index idx_setting_key(setting_key) comment '配置键索引'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='系统配置表';


-- ============================================================================
-- 10. 罚款缴费表 (fine)
--    记录读者的逾期罚款及缴费情况
--    每笔借阅记录的逾期费对应一条罚款记录，支持部分缴费
--    状态流转：unpaid → partial（部分缴纳）→ paid（已缴清）
-- ============================================================================
create table fine(
    id int primary key auto_increment comment '罚款记录ID',
    user_id int not null comment '用户ID（冗余，便于查询）',
    borrow_record_id int not null comment '关联借阅记录ID',
    fine_amount decimal(10,2) not null comment '罚款总金额',
    paid_amount decimal(10,2) not null default 0 comment '已缴金额',
    status enum('unpaid', 'partial', 'paid') not null default 'unpaid' comment '缴费状态',
    paid_at datetime comment '最后缴费时间',
    operator_id int comment '收款操作员ID',
    notes varchar(500) comment '备注',
    created_at datetime not null default current_timestamp comment '创建时间',
    updated_at datetime not null default current_timestamp on update current_timestamp comment '更新时间',

    foreign key (user_id) references user(id) on delete cascade,
    foreign key (borrow_record_id) references borrowrecord(id) on delete cascade,
    foreign key (operator_id) references user(id) on delete set null,
    index idx_user_id(user_id) comment '用户ID索引',
    index idx_borrow_record_id(borrow_record_id) comment '借阅记录ID索引',
    index idx_status(status) comment '缴费状态索引'
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci comment='罚款缴费记录表';


-- ============================================================================
-- 触发器：自动维护图书表库存数量
-- ============================================================================
-- 说明：
--   - update_book_copies_after_insert：新增副本时，total_copies +1；若新增副本状态为 available，则 available_copies 也 +1
--   - update_book_copies_after_update：副本状态变化时，根据新旧状态调整 available_copies
--   - update_book_copies_after_delete：删除副本时，total_copies -1；若被删副本为 available，则 available_copies 也 -1
--   - 注意：update 触发器中还处理了副本所属图书变更（book_id 变化）的边界情况
-- ============================================================================

delimiter //

-- 新增图书副本后自动更新图书表库存
create trigger update_book_copies_after_insert
after insert on book_copies
for each row
begin
    update book
    set total_copies = total_copies + 1,
        available_copies = available_copies + if(new.status = 'available', 1, 0)
    where id = new.book_id; -- 新增图书副本后更新图书表库存
end//

-- 修改图书副本状态后自动更新图书表库存
create trigger update_book_copies_after_update
after update on book_copies
for each row
begin
    -- 副本从"可借"变为"不可借"（如被借出、损坏等）：可用数 -1
    if old.status = 'available' and new.status != 'available' then
        update book
        set available_copies = available_copies - 1
        where id = new.book_id; -- 借书后更新图书表库存

    -- 副本从"不可借"变为"可借"（如归还、修复等）：可用数 +1
    elseif old.status != 'available' and new.status = 'available' then
        update book
        set available_copies = available_copies + 1
        where id = new.book_id; -- 还书后更新图书表库存
    end if;

    -- 处理副本所属图书变更的边界情况（条形码不变但 book_id 变了）
    if old.book_id != new.book_id then
        -- 旧图书库存减少
        update book
        set total_copies = total_copies - 1,
            available_copies = available_copies - if(old.status = 'available', 1, 0)
        where id = old.book_id;
        -- 新图书库存增加
        update book
        set total_copies = total_copies + 1,
            available_copies = available_copies + if(new.status = 'available', 1, 0)
        where id = new.book_id;
    end if;
end//

-- 删除图书副本后自动更新图书表库存
create trigger update_book_copies_after_delete
after delete on book_copies
for each row
begin
    update book
    set total_copies = total_copies - 1,
        available_copies = available_copies - if(old.status = 'available', 1, 0)
    where id = old.book_id;
end//

delimiter ;


-- ============================================================================
-- 视图
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 视图 1：图书借阅情况统计 (book_inventory_view)
--   展示当前所有活跃借阅记录（借阅中、逾期、续借），关联读者→读者卡→副本→图书→管理员
--   直观回答"谁借了什么书、用哪个证、什么时候借的、什么时候该还"
-- ---------------------------------------------------------------------------
create or replace view book_inventory_view as
select
    -- 借阅记录信息
    br.id as borrow_record_id,
    br.status as borrow_status,
    br.borrow_date,
    br.due_date,
    datediff(curdate(), br.due_date) as overdue_days,    -- 逾期天数（正数 = 已逾期）
    br.return_date,
    br.renewed_times,
    br.max_renew_times,
    br.overdue_fee,

    -- 读者信息
    br.read_card_id,
    rc.card_number,
    rc.max_borrow_limit,
    rc.current_borrow_count,
    u.id as user_id,
    u.username,
    u.real_name,
    u.email,
    u.phone,

    -- 图书副本信息
    br.book_copy_id,
    bc.barcode,
    bc.location,

    -- 图书信息
    b.id as book_id,
    b.isbn,
    b.title,
    b.author,
    b.publisher,
    b.category_id,

    -- 管理员信息（注意：使用 lib 别名，不是 u 别名）
    br.librarian_id,
    lib.username as librarian_username,
    lib.real_name as librarian_real_name,
    br.return_librarian_id

from borrowrecord br
join reader_card rc on br.read_card_id = rc.id
join user u on rc.user_id = u.id
join book_copies bc on br.book_copy_id = bc.id
join book b on bc.book_id = b.id
join user lib on br.librarian_id = lib.id             -- lib = 借出操作的管理员
where br.status in ('borrowing', 'overdue', 'renewed');


-- ---------------------------------------------------------------------------
-- 视图 2：图书完整信息（含分类）(book_category_view)
--   图书主表关联分类表，同时显示一级分类名称（通过 parent_id 关联）
-- ---------------------------------------------------------------------------
create or replace view book_category_view as
select
    b.id as book_id,
    b.isbn,
    b.title,
    b.author,
    b.publisher,
    b.publish_date,
    b.category_id,
    c.name as category_name,
    b.total_copies,
    b.available_copies,
    c.parent_id as category_parent_id,
    pc.name as category_parent_name       -- 父级分类名称
from book b
left join category c on b.category_id = c.id
left join category pc on c.parent_id = pc.id;


-- ---------------------------------------------------------------------------
-- 视图 3：逾期管理视图 (overdue_management_view_fixed)
--   按用户汇总逾期情况，用于催还管理
--   包含逾期数量、逾期总费用、逾期天数范围、逾期图书清单
-- ---------------------------------------------------------------------------
create or replace view overdue_management_view_fixed as
select
    u.id as user_id,
    u.username as user_name,
    u.real_name,
    u.email,
    u.phone,
    rc.card_number,
    count(*) as overdue_count,
    sum(br.overdue_fee) as overdue_fee_total,
    max(br.due_date) as latest_due_date,
    min(datediff(curdate(), br.due_date)) as min_overdue_days,   -- 最短逾期天数
    max(datediff(curdate(), br.due_date)) as max_overdue_days,   -- 最长逾期天数
    group_concat(distinct br.id) as overdue_record_ids,
    group_concat(distinct b.title separator '; ') as overdue_book_titles  -- 逾期图书名称（分号分隔）
from user u
join borrowrecord br on u.id = (select user_id from reader_card where id = br.read_card_id)
join reader_card rc on br.read_card_id = rc.id
join book_copies bc on br.book_copy_id = bc.id
join book b on bc.book_id = b.id
where br.status = 'overdue'
group by u.id, u.username, u.real_name, u.email, u.phone, rc.card_number;


-- ---------------------------------------------------------------------------
-- 视图 4：图书借阅排行榜 (book_borrowing_ranking_view)
--   按图书总借阅次数降序排列，展示借阅热度
--   借阅率 = 总借阅次数 / 总副本数 × 100%
-- ---------------------------------------------------------------------------
create or replace view book_borrowing_ranking_view as
select
    b.id as book_id,
    b.isbn,
    b.title,
    b.author,
    b.publisher,
    c.name as category_name,
    count(distinct br.id) as total_borrows,
    count(distinct case when br.status in ('borrowing', 'renewed') then br.id end) as current_borrows,
    b.total_copies,
    b.available_copies,
    round((count(distinct br.id) / nullif(b.total_copies, 0)) * 100, 2) as borrow_rate  -- 借阅率（%），避免除以0
from book b
left join book_copies bc on b.id = bc.book_id
left join borrowrecord br on bc.id = br.book_copy_id
left join category c on b.category_id = c.id
group by b.id, b.isbn, b.title, b.author, b.publisher, c.name, b.total_copies, b.available_copies
order by total_borrows desc;


-- ---------------------------------------------------------------------------
-- 视图 5：读者借阅历史统计 (reader_borrowing_history_view)
--   展示每位读者的每笔借阅详情，包含借阅时长、是否逾期归还、状态描述
-- ---------------------------------------------------------------------------
create or replace view reader_borrowing_history_view as
select
    br.id as borrow_record_id,
    br.read_card_id,
    rc.card_number,
    u.username,
    u.real_name as reader_name,
    b.id as book_id,
    b.title as book_title,
    b.author,
    bc.barcode,
    br.borrow_date,
    br.due_date,
    br.return_date,
    br.status as borrow_status,
    br.renewed_times,
    br.overdue_fee as fine_amount,

    -- 借阅状态中文描述
    case
        when br.return_date is not null then '已归还'
        when br.status = 'overdue' then concat('逾期', datediff(curdate(), br.due_date), '天')
        else '借阅中'
    end as borrow_status_desc,

    -- 借阅时长（已归还=实际天数，未归还=至今已借天数）
    case
        when br.return_date is not null then datediff(br.return_date, br.borrow_date)
        else datediff(curdate(), br.borrow_date)
    end as borrow_duration_days,

    -- 归还准时性判断
    case
        when br.return_date > br.due_date then '逾期归还'
        when br.return_date is null and curdate() > br.due_date then '逾期未还'
        when br.status = 'renewed' then concat('续借中(剩余', br.max_renew_times - br.renewed_times, '次续借机会)')
        else '按时归还/借阅中'
    end as return_timeliness

from borrowrecord br
join reader_card rc on br.read_card_id = rc.id
join user u on rc.user_id = u.id
join book_copies bc on br.book_copy_id = bc.id
join book b on bc.book_id = b.id
order by br.borrow_date desc;


-- ---------------------------------------------------------------------------
-- 视图 6：图书库存预警 (book_inventory_alert_view)
--   监控库存紧张或为零的图书，分级预警
-- ---------------------------------------------------------------------------
create or replace view book_inventory_alert_view as
select
    b.id as book_id,
    b.isbn,
    b.title,
    b.author,
    b.publisher,
    c.name as category_name,
    b.total_copies,
    b.available_copies,
    (b.total_copies - b.available_copies) as borrowed_copies,  -- 在借数量

    -- 库存状态分级
    case
        when b.available_copies = 0 and b.total_copies > 0 then '零库存'
        when b.available_copies = 1 then '只剩一本库存'
        when b.available_copies <= 2 then '库存紧张'
        else '正常'
    end as inventory_status

from book b
left join category c on b.category_id = c.id
group by b.id, b.isbn, b.title, b.author, b.publisher, c.name, b.total_copies, b.available_copies
having b.available_copies <= 2 or b.available_copies = 0     -- 仅展示库存紧张及以下的图书
order by inventory_status desc;


-- ---------------------------------------------------------------------------
-- 视图 7：读者评估分析 (reader_analysis_view)
--   对每位读者进行综合评估，计算信用分、划分读者等级、判定借阅资格
--   信用分 = 100 - (逾期次数 × 10) - (逾期总费用 × 2)，最低 0 分
-- ---------------------------------------------------------------------------
create or replace view reader_analysis_view as
select
    u.id as user_id,
    u.username,
    u.real_name,
    u.email,
    u.phone,
    rc.card_number,
    rc.max_borrow_limit,
    rc.current_borrow_count,
    rc.expire_date,

    -- 借阅历史统计
    count(distinct br.id) as total_borrows,
    count(distinct case when br.status in ('borrowing', 'renewed') then br.id end) as current_borrows,
    count(distinct case when br.status = 'overdue' then br.id end) as overdue_borrows,
    count(distinct case when br.status = 'returned' then br.id end) as returned_borrows,

    -- 信用分计算（基础100分，每次逾期-10分，逾期费用每元-2分，最低0分）
    greatest(0, 100
        - (count(distinct case when br.status = 'overdue' then br.id end) * 10)
        - sum(br.overdue_fee) * 2
    ) as credit_score,

    -- 读者分类（综合考虑借阅量和信用分）
    case
        when count(distinct br.id) >= 50
             and greatest(0, 100 - (count(distinct case when br.status = 'overdue' then br.id end) * 10) - (sum(br.overdue_fee) * 2)) >= 90
             then '高级读者'
        when count(distinct br.id) >= 20
             and greatest(0, 100 - (count(distinct case when br.status = 'overdue' then br.id end) * 10) - (sum(br.overdue_fee) * 2)) >= 70
             then '中级读者'
        when count(distinct br.id) >= 10
             and greatest(0, 100 - (count(distinct case when br.status = 'overdue' then br.id end) * 10) - (sum(br.overdue_fee) * 2)) >= 20
             then '劣质读者'
        else '初级读者'
    end as reader_category,

    -- 借阅资格评估
    case
        when rc.expire_date < curdate() then '卡已过期'
        when sum(case when br.status = 'overdue' then br.overdue_fee else 0 end) > 50 then '欠费过多'
        when greatest(0, 100 - (count(distinct case when br.status = 'overdue' then br.id end) * 10) - (sum(br.overdue_fee) * 2)) < 30 then '信用分过低'
        when rc.current_borrow_count >= rc.max_borrow_limit then '已达借阅上限'
        else '可借阅'
    end as borrow_eligibility_status

from user u
join reader_card rc on u.id = rc.user_id
left join borrowrecord br on rc.id = br.read_card_id
where u.role = 'reader'
group by u.id, u.username, u.real_name, u.email, u.phone, rc.card_number, rc.max_borrow_limit, rc.current_borrow_count, rc.expire_date
order by credit_score desc, total_borrows desc;


-- ---------------------------------------------------------------------------
-- 视图 8：读者喜好分析 (reader_preference_view)
--   分析每位读者在各分类下的借阅频次和偏好作者
--   使用窗口函数计算每个分类在读者总借阅中的占比
-- ---------------------------------------------------------------------------
create or replace view reader_preference_view as
select
    u.id as user_id,
    u.real_name as reader_name,
    rc.card_number,
    c.id as category_id,
    c.name as category_name,
    pc.name as parent_category_name,
    count(*) as borrow_count_in_category,
    round(count(*) / nullif(sum(count(*)) over (partition by u.id), 0) * 100, 2) as percentage,  -- 该分类借阅占比（%）

    -- 该分类下借阅最多的作者 TOP3（子查询实现）
    (select group_concat(t.author separator ', ') from (
        select b2.author
        from borrowrecord br2
        join book_copies bc2 on br2.book_copy_id = bc2.id
        join book b2 on bc2.book_id = b2.id
        where br2.read_card_id = rc.id and b2.category_id = c.id
        group by b2.author
        order by count(*) desc
        limit 3
     ) t) as favorite_authors_in_category

from user u
join reader_card rc on u.id = rc.user_id
join borrowrecord br on rc.id = br.read_card_id
join book_copies bc on br.book_copy_id = bc.id
join book b on bc.book_id = b.id
join category c on b.category_id = c.id
left join category pc on c.parent_id = pc.id
group by u.id, u.real_name, rc.card_number, c.id, c.name, pc.name;


-- ---------------------------------------------------------------------------
-- 视图 9：预约排队视图 (reservation_queue_view)
--   展示活跃预约的排队状态、等待天数和预计可取时间
--   使用窗口函数 row_number() 按图书分组、按预约日期排序计算排队位置
-- ---------------------------------------------------------------------------
create or replace view reservation_queue_view as
select
    r.id as reservation_id,
    r.reserve_date,
    r.expire_date,
    datediff(curdate(), r.reserve_date) as waiting_days,        -- 已等待天数
    datediff(r.expire_date, curdate()) as remaining_days,       -- 剩余有效天数
    r.status as reservation_status,

    -- 图书信息
    b.id as book_id,
    b.title as book_title,
    b.author,
    b.publisher,
    c.name as category_name,

    -- 预约用户信息
    u.id as user_id,
    u.real_name,
    u.email,
    u.phone,
    rc.card_number as reader_card_no,

    -- 排队位置：同书按预约时间排序
    row_number() over (partition by r.book_id order by r.reserve_date) as queue_position,

    -- 预计可取时间：假设每本平均借出14天，有库存则立即可取，否则按排队位置估算
    case
        when b.available_copies > 0 then '立即可借'
        else date_add(curdate(), interval (row_number() over (partition by r.book_id order by r.reserve_date) - 1) * 14 day)
    end as estimated_waiting_time_days,

    -- 预约状态中文描述
    case
        when r.status = 'active' and b.available_copies > 0 then '可借阅'
        when r.status = 'active' and b.available_copies = 0 then '等待中'
        when r.status = 'expired' then '已过期'
        when r.status = 'cancelled' then '已取消'
        else r.status
    end as reservation_status_desc

from reservation r
join book b on r.book_id = b.id
join category c on b.category_id = c.id
join user u on r.user_id = u.id
join reader_card rc on u.id = rc.user_id
where r.status = 'active'    -- 仅展示活跃状态的预约
order by r.book_id, r.reserve_date;


-- ---------------------------------------------------------------------------
-- 视图 10：图书副本追踪 (book_copy_tracking_view)
--   追踪每个图书副本的全生命周期：借阅频次、状态变更历史、使用频率评级
-- ---------------------------------------------------------------------------
create or replace view book_copy_tracking_view as
select
    -- 图书副本信息
    bc.id as copy_id,
    bc.barcode,
    bc.status,
    bc.location,
    bc.purchase_date,
    bc.created_at as stock_in_date,

    -- 图书信息
    b.id as book_id,
    b.isbn,
    b.title,
    b.author,
    b.publisher,

    -- 借阅记录统计
    count(distinct br.id) as total_borrows,
    min(br.borrow_date) as first_borrow_date,
    max(br.borrow_date) as last_borrow_date,
    sum(case when br.status = 'returned' then datediff(br.return_date, br.borrow_date) end) as total_borrow_days,
    avg(case when br.status = 'returned' then datediff(br.return_date, br.borrow_date) end) as avg_borrow_duration,

    -- 状态变更历史（按时间顺序，用箭头串联）
    group_concat(distinct ir.operation_type order by ir.operation_date separator '-> ') as status_history,
    max(ir.operation_date) as last_operation_date,

    -- 使用频率评级
    case
        when count(distinct br.id) >= 20 then '高频使用'
        when count(distinct br.id) >= 5 then '中频使用'
        else '低频使用'
    end as usage_frequency,

    -- 当前状态分析建议
    case
        when bc.status = 'damaged' and count(distinct br.id) = 0 then '建议报废'
        when bc.status = 'lost' then '建议找回或补充'
        when count(distinct br.id) = 0 and datediff(curdate(), bc.created_at) > 365 then '长期未使用,建议下架'
        else '正常使用'
    end as current_status_analysis

from book_copies bc
join book b on bc.book_id = b.id
left join borrowrecord br on bc.id = br.book_copy_id
left join inventoryrecord ir on bc.id = ir.book_copy_id
group by bc.id, bc.barcode, bc.location, bc.purchase_date, bc.status, bc.created_at,
         b.id, b.isbn, b.title, b.author, b.publisher
order by total_borrows desc;


-- ---------------------------------------------------------------------------
-- 视图 11：馆员工作记录 (librarian_worklog_view)
--   按馆员 + 日期汇总各类库存操作的次数，用于馆员绩效统计
-- ---------------------------------------------------------------------------
create or replace view librarian_worklog_view as
select
    u.id as librarian_id,
    u.real_name as librarian_name,
    date(ir.operation_date) as work_date,
    count(distinct case when ir.operation_type = 'stock_in' then ir.id end) as stock_in_count,
    count(distinct case when ir.operation_type = 'inventory_check' then ir.id end) as inventory_check_count,
    count(distinct case when ir.operation_type = 'damaged' then ir.id end) as damaged_count,
    count(distinct case when ir.operation_type = 'scrapped' then ir.id end) as scrapped_count,
    count(distinct case when ir.operation_type = 'lost' then ir.id end) as lost_count

from user u
join inventoryrecord ir on u.id = ir.operator_id
where u.role = 'librarian'
group by u.id, u.real_name, date(ir.operation_date);



-- ============================================================================
-- 存储过程
-- ============================================================================

delimiter //

-- ---------------------------------------------------------------------------
-- 存储过程 1：借书处理 (sp_borrow_book)
--   参数：
--     IN  p_card_number   - 读者卡号
--     IN  p_book_id       - 图书ID
--     IN  p_book_barcode  - 图书副本条形码
--     IN  p_operator_id   - 操作员（馆员）ID
--     OUT p_result_code   - 结果码（0=成功）
--     OUT p_result_message - 结果消息
--   流程：验证读者卡 → 验证副本状态 → 检查借阅限额 → 事务内执行借书
--   注意：借阅天数默认30天，在变量 v_borrow_days 中配置
-- ---------------------------------------------------------------------------
create procedure sp_borrow_book(
    in p_card_number varchar(20),
    in p_book_id int,
    in p_book_barcode varchar(50),
    in p_operator_id int,
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    -- 局部变量声明
    declare v_reader_card_id int;
    declare v_user_id int;
    declare v_book_id int;
    declare v_copy_id int;
    declare v_card_status varchar(20);
    declare v_copy_status varchar(20);
    declare v_max_borrow_limit int;
    declare v_current_borrow_count int;
    declare v_borrow_days int;
    declare v_card_number varchar(20);

    -- [修改] 从系统配置读取借阅天数，若未配置则默认30天
    select coalesce(cast(setting_value as signed), 30) into v_borrow_days
    from system_config where setting_key = 'borrow_days';

    -- 初始化输出参数
    set p_result_code = 0;
    set p_result_message = '借书成功';

    -- 步骤1：验证读者卡是否存在且有效
    select id, user_id, status, card_number
        into v_reader_card_id, v_user_id, v_card_status, v_card_number
    from reader_card
    where card_number = p_card_number and status = 'active';

    if v_reader_card_id is null then
        set p_result_code = 1;
        set p_result_message = '读者卡不存在或已失效';
    elseif v_card_status != 'active' then
        set p_result_code = 2;
        set p_result_message = '读者卡状态异常';
    else
        -- 步骤2：检查图书副本是否存在且可借
        select id, book_id, status
            into v_copy_id, v_book_id, v_copy_status
        from book_copies
        where barcode = p_book_barcode and status = 'available';

        if v_copy_id is null then
            set p_result_code = 3;
            set p_result_message = '图书副本不存在或不可用';
        elseif v_copy_status != 'available' then
            set p_result_code = 4;
            set p_result_message = '图书副本状态异常';
        else
            -- 步骤3：检查读者当前借阅数量是否已达上限
            select current_borrow_count, max_borrow_limit
                into v_current_borrow_count, v_max_borrow_limit
            from reader_card
            where id = v_reader_card_id;

            if v_current_borrow_count >= v_max_borrow_limit then
                set p_result_code = 5;
                set p_result_message = '超过最大借阅数量,请归还部分图书后再试';
            else
                -- 步骤4：在事务中执行借书操作
                start transaction;

                -- 创建借阅记录
                insert into borrowrecord
                    (read_card_id, book_copy_id, borrow_date, due_date, status, librarian_id)
                values
                    (v_reader_card_id, v_copy_id, date(now()), date_add(now(), interval v_borrow_days day), 'borrowing', p_operator_id);

                -- 更新副本状态为"已借出"
                update book_copies
                set status = 'borrowed'
                where id = v_copy_id;

                -- 记录库存操作日志
                insert into inventoryrecord
                    (book_copy_id, operator_id, operation_type, operation_date, notes)
                values
                    (v_copy_id, p_operator_id, 'borrowed', now(), concat('借出图书副本ID:', p_book_barcode));

                commit;
            end if;
        end if;
    end if;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 2：还书处理 (sp_return_book)
--   参数：
--     IN  p_book_barcode   - 图书副本条形码
--     IN  p_operator_id    - 操作员（馆员）ID
--     OUT p_result_code    - 结果码（0=成功）
--     OUT p_result_message - 结果消息
--     OUT p_overdue_days   - 逾期天数
--     OUT p_overdue_fee    - 逾期费用（每天1元）
--   流程：查找借阅记录 → 判断是否逾期并计费 → 事务内执行还书
-- ---------------------------------------------------------------------------
create procedure sp_return_book(
    in p_operator_id int,
    in p_book_barcode varchar(50),
    out p_result_code int,
    out p_result_message varchar(100),
    out p_overdue_days int,
    out p_overdue_fee numeric(10,2)
)
begin
    declare v_copy_id int;
    declare v_borrow_record_id int;
    declare v_due_date datetime;
    declare v_status varchar(20);
    declare v_book_id int;                        -- [新增] 图书ID，用于预约检查
    declare v_fine_rate decimal(10,2);            -- [新增] 逾期费率(元/天)
    declare v_has_reservation int default 0;      -- [新增] 是否有活跃预约

    -- 初始化输出参数
    set p_result_code = 0;
    set p_overdue_days = 0;
    set p_overdue_fee = 0;
    set p_result_message = '还书成功';

    -- 步骤1：查找该副本对应的活跃借阅记录（取最新一条）
    select br.id, br.due_date, br.status, bc.id, bc.book_id
        into v_borrow_record_id, v_due_date, v_status, v_copy_id, v_book_id
    from borrowrecord br
    join book_copies bc on br.book_copy_id = bc.id
    where p_book_barcode = bc.barcode
      and br.status in ('borrowing', 'overdue', 'renewed')
    order by br.id desc
    limit 1;

    if v_copy_id is null then
        set p_result_code = 1;
        set p_result_message = '未找到对应的借阅记录';
    else
        -- [修改] 从系统配置读取逾期费率(元/天)，默认1元/天
        select coalesce(cast(setting_value as decimal(10,2)), 1) into v_fine_rate
        from system_config where setting_key = 'overdue_fine_rate';

        -- 步骤2：检查是否逾期，计算逾期天数和费用
        if now() > v_due_date then
            set p_overdue_days = datediff(now(), v_due_date);
            set p_overdue_fee = p_overdue_days * v_fine_rate;
        end if;

        -- 步骤3：在事务中执行还书操作
        start transaction;

        -- 更新借阅记录：记录归还时间、状态、操作员、逾期费用
        update borrowrecord
        set return_date = now(),
            status = 'returned',
            return_librarian_id = p_operator_id,
            overdue_fee = p_overdue_fee
        where id = v_borrow_record_id;

        -- [修改] 检查是否有该书的活跃预约(按预约时间排队)
        select count(*) into v_has_reservation
        from reservation
        where book_id = v_book_id and status = 'active'
        order by reserve_date limit 1;

        -- 有预约则设为保留状态，无预约则恢复为可借
        if v_has_reservation > 0 then
            update book_copies
            set status = 'reserved'
            where id = v_copy_id;
        else
            update book_copies
            set status = 'available'
            where id = v_copy_id;
        end if;

        -- 记录库存操作日志
        insert into inventoryrecord
            (book_copy_id, operator_id, operation_type, operation_date, notes)
        values
            (v_copy_id, p_operator_id, 'returned', now(), concat('还书图书副本ID:', p_book_barcode));

        commit;
    end if;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 3：逾期检查 (sp_check_overdue)
--   定时任务调用：将到期未还的借阅记录状态从 borrowing 改为 overdue
--   建议通过 MySQL Event Scheduler 定时执行（如每天凌晨1点）
-- ---------------------------------------------------------------------------
create procedure sp_check_overdue()
begin
    update borrowrecord
    set status = 'overdue'
    where status = 'borrowing' and now() > due_date;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 4：续借处理 (sp_renew_book)
--   参数：
--     IN  p_borrow_record_id - 借阅记录ID
--     IN  p_operator_id      - 操作员(馆员)ID
--     OUT p_result_code      - 结果码(0=成功)
--     OUT p_result_message   - 结果消息
--   流程：验证借阅记录状态 → 检查剩余续借次数 → 事务内延长到期日
--   续借天数从 system_config 读取(renew_days)，默认30天
-- ---------------------------------------------------------------------------
create procedure sp_renew_book(
    in p_borrow_record_id int,
    in p_operator_id int,
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    declare v_status varchar(20);
    declare v_renewed_times int;
    declare v_max_renew_times int;
    declare v_renew_days int;

    set p_result_code = 0;
    set p_result_message = '续借成功';

    -- [新增] 从系统配置读取续借天数，默认30天
    select coalesce(cast(setting_value as signed), 30) into v_renew_days
    from system_config where setting_key = 'renew_days';

    -- 检查借阅记录状态
    select status, renewed_times, max_renew_times
    into v_status, v_renewed_times, v_max_renew_times
    from borrowrecord where id = p_borrow_record_id;

    if v_status is null then
        set p_result_code = 1;
        set p_result_message = '借阅记录不存在';
    elseif v_status not in ('borrowing', 'renewed') then
        set p_result_code = 2;
        set p_result_message = '该借阅记录状态不允许续借';
    elseif v_renewed_times >= v_max_renew_times then
        set p_result_code = 3;
        set p_result_message = '已达最大续借次数';
    else
        start transaction;

        update borrowrecord
        set renewed_times = renewed_times + 1,
            status = 'renewed',
            due_date = date_add(due_date, interval v_renew_days day)
        where id = p_borrow_record_id;

        commit;
    end if;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 5：创建预约 (sp_create_reservation)
--   参数：
--     IN  p_user_id       - 用户ID
--     IN  p_book_id       - 图书ID
--     IN  p_expire_days   - 预约有效天数
--     OUT p_result_code   - 结果码(0=成功)
--     OUT p_result_message - 结果消息
--   规则：不可重复预约同一本书；有可借副本时提示直接借阅
-- ---------------------------------------------------------------------------
create procedure sp_create_reservation(
    in p_user_id int,
    in p_book_id int,
    in p_expire_days int,
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    declare v_book_title varchar(200);
    declare v_available int;
    declare v_existing int;

    set p_result_code = 0;
    set p_result_message = '预约成功';

    -- 验证图书存在
    select title, available_copies into v_book_title, v_available
    from book where id = p_book_id;

    if v_book_title is null then
        set p_result_code = 1;
        set p_result_message = '图书不存在';
    else
        -- 检查是否已有活跃预约
        select count(*) into v_existing
        from reservation
        where user_id = p_user_id and book_id = p_book_id and status in ('pending', 'active');

        if v_existing > 0 then
            set p_result_code = 2;
            set p_result_message = '您已预约过该图书，请勿重复预约';
        elseif v_available > 0 then
            set p_result_code = 3;
            set p_result_message = '该图书尚有可借副本，可直接借阅';
        else
            insert into reservation(user_id, book_id, expire_date, status)
            values(p_user_id, p_book_id, date_add(now(), interval p_expire_days day), 'active');
        end if;
    end if;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 6：取消预约 (sp_cancel_reservation)
--   参数：
--     IN  p_reservation_id - 预约ID
--     IN  p_user_id        - 用户ID(校验权限)
--     OUT p_result_code    - 结果码(0=成功)
--     OUT p_result_message - 结果消息
-- ---------------------------------------------------------------------------
create procedure sp_cancel_reservation(
    in p_reservation_id int,
    in p_user_id int,
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    declare v_status varchar(20);

    set p_result_code = 0;
    set p_result_message = '预约取消成功';

    select status into v_status from reservation
    where id = p_reservation_id and user_id = p_user_id;

    if v_status is null then
        set p_result_code = 1;
        set p_result_message = '预约记录不存在或无权操作';
    elseif v_status not in ('pending', 'active') then
        set p_result_code = 2;
        set p_result_message = '该预约状态不允许取消';
    else
        update reservation set status = 'cancelled' where id = p_reservation_id;
    end if;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 7：读者注册 (sp_register_reader)
--   参数：
--     IN  p_username         - 用户名
--     IN  p_password_hash    - 密码哈希
--     IN  p_email            - 邮箱
--     IN  p_real_name        - 真实姓名
--     IN  p_phone            - 电话
--     IN  p_card_number      - 读者卡号
--     IN  p_max_borrow_limit - 最大借阅数量
--     IN  p_expire_date      - 读者卡过期日期
--     IN  p_operator_id      - 操作员ID
--     OUT p_result_code      - 结果码(0=成功)
--     OUT p_result_message   - 结果消息
--   事务内同时创建 user + reader_card，保证数据一致性
-- ---------------------------------------------------------------------------
create procedure sp_register_reader(
    in p_username varchar(20),
    in p_password_hash varchar(255),
    in p_email varchar(50),
    in p_real_name varchar(20),
    in p_phone varchar(20),
    in p_card_number varchar(20),
    in p_max_borrow_limit int,
    in p_expire_date date,
    in p_operator_id int,
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    declare v_user_id int;

    set p_result_code = 0;
    set p_result_message = '读者注册成功';

    start transaction;

    insert into user(username, password_hash, email, real_name, phone, role)
    values(p_username, p_password_hash, p_email, p_real_name, p_phone, 'reader');

    set v_user_id = last_insert_id();

    insert into reader_card(user_id, card_number, max_borrow_limit, expire_date)
    values(v_user_id, p_card_number, p_max_borrow_limit, p_expire_date);

    commit;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 8：新书入库 (sp_add_book)
--   参数：
--     IN  p_isbn         - ISBN
--     IN  p_title        - 书名
--     IN  p_author       - 作者
--     IN  p_publisher    - 出版社
--     IN  p_publish_date - 出版日期
--     IN  p_category_id  - 分类ID
--     IN  p_description  - 描述
--     IN  p_cover_url    - 封面URL
--     IN  p_language     - 语言
--     IN  p_price        - 价格
--     IN  p_barcodes     - 条形码列表(逗号分隔)
--     IN  p_location     - 馆藏位置
--     IN  p_operator_id  - 操作员ID
--     OUT p_result_code  - 结果码(0=成功)
--     OUT p_result_message - 结果消息
--   事务内创建 book + 批量创建 book_copies + 记录入库日志
-- ---------------------------------------------------------------------------
create procedure sp_add_book(
    in p_isbn varchar(20),
    in p_title varchar(200),
    in p_author varchar(100),
    in p_publisher varchar(100),
    in p_publish_date date,
    in p_category_id int,
    in p_description text,
    in p_cover_url varchar(500),
    in p_language varchar(20),
    in p_price decimal(10,2),
    in p_barcodes text,
    in p_location varchar(100),
    in p_operator_id int,
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    declare v_book_id int;
    declare v_barcode varchar(20);
    declare v_pos int default 1;
    declare v_remainder text;

    set p_result_code = 0;
    set p_result_message = '图书入库成功';

    start transaction;

    insert into book(isbn, title, author, publisher, publish_date, category_id, description, cover_url, language, price)
    values(p_isbn, p_title, p_author, p_publisher, p_publish_date, p_category_id, p_description, p_cover_url, p_language, p_price);

    set v_book_id = last_insert_id();

    -- 批量创建副本(条形码用逗号分隔)
    set v_remainder = p_barcodes;
    while char_length(v_remainder) > 0 do
        set v_pos = locate(',', v_remainder);
        if v_pos = 0 then
            set v_barcode = trim(v_remainder);
            set v_remainder = '';
        else
            set v_barcode = trim(substring(v_remainder, 1, v_pos - 1));
            set v_remainder = substring(v_remainder, v_pos + 1);
        end if;

        if char_length(v_barcode) > 0 then
            insert into book_copies(book_id, barcode, location, purchase_date)
            values(v_book_id, v_barcode, p_location, curdate());

            insert into inventoryrecord(book_copy_id, operator_id, operation_type, operation_date, notes)
            values(last_insert_id(), p_operator_id, 'stock_in', now(), concat('新书入库:', p_title));
        end if;
    end while;

    commit;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 9：补充副本入库 (sp_stock_in)
--   参数：
--     IN  p_book_id      - 已有图书ID
--     IN  p_barcode      - 新副本条形码
--     IN  p_location     - 馆藏位置
--     IN  p_operator_id  - 操作员ID
--     OUT p_result_code  - 结果码(0=成功)
--     OUT p_result_message - 结果消息
--   为已有图书增加单个副本
-- ---------------------------------------------------------------------------
create procedure sp_stock_in(
    in p_book_id int,
    in p_barcode varchar(20),
    in p_location varchar(100),
    in p_operator_id int,
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    declare v_copy_id int;
    declare v_book_title varchar(200);

    set p_result_code = 0;
    set p_result_message = '副本入库成功';

    select title into v_book_title from book where id = p_book_id;
    if v_book_title is null then
        set p_result_code = 1;
        set p_result_message = '图书不存在';
    else
        start transaction;

        insert into book_copies(book_id, barcode, location, purchase_date)
        values(p_book_id, p_barcode, p_location, curdate());

        set v_copy_id = last_insert_id();

        insert into inventoryrecord(book_copy_id, operator_id, operation_type, operation_date, notes)
        values(v_copy_id, p_operator_id, 'stock_in', now(), concat('补充副本:', v_book_title));

        commit;
    end if;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 10：损坏登记 (sp_report_damaged)
--   参数：
--     IN  p_copy_id      - 图书副本ID
--     IN  p_operator_id  - 操作员ID
--     IN  p_notes        - 备注
--     OUT p_result_code  - 结果码(0=成功)
--     OUT p_result_message - 结果消息
--   将副本标记为损坏，若正被借出则先强制归还借阅记录
-- ---------------------------------------------------------------------------
create procedure sp_report_damaged(
    in p_copy_id int,
    in p_operator_id int,
    in p_notes varchar(500),
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    declare v_status varchar(20);
    declare v_borrow_id int;

    set p_result_code = 0;
    set p_result_message = '损坏登记成功';

    select status into v_status from book_copies where id = p_copy_id;

    if v_status is null then
        set p_result_code = 1;
        set p_result_message = '图书副本不存在';
    else
        start transaction;

        -- 如果副本当前被借出，先强制归还借阅记录
        if v_status = 'borrowed' then
            select id into v_borrow_id from borrowrecord
            where book_copy_id = p_copy_id and status in ('borrowing', 'overdue', 'renewed')
            order by id desc limit 1;

            if v_borrow_id is not null then
                update borrowrecord
                set return_date = now(), status = 'returned',
                    notes = concat('图书损坏强制归还: ', ifnull(p_notes, ''))
                where id = v_borrow_id;
            end if;
        end if;

        update book_copies set status = 'damaged' where id = p_copy_id;

        insert into inventoryrecord(book_copy_id, operator_id, operation_type, operation_date, notes)
        values(p_copy_id, p_operator_id, 'damaged', now(), p_notes);

        commit;
    end if;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 11：丢失登记 (sp_report_lost)
--   参数：
--     IN  p_copy_id      - 图书副本ID
--     IN  p_operator_id  - 操作员ID
--     IN  p_notes        - 备注
--     OUT p_result_code  - 结果码(0=成功)
--     OUT p_result_message - 结果消息
--   将副本标记为丢失，若正被借出则先强制归还借阅记录
-- ---------------------------------------------------------------------------
create procedure sp_report_lost(
    in p_copy_id int,
    in p_operator_id int,
    in p_notes varchar(500),
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    declare v_status varchar(20);
    declare v_borrow_id int;

    set p_result_code = 0;
    set p_result_message = '丢失登记成功';

    select status into v_status from book_copies where id = p_copy_id;

    if v_status is null then
        set p_result_code = 1;
        set p_result_message = '图书副本不存在';
    else
        start transaction;

        if v_status = 'borrowed' then
            select id into v_borrow_id from borrowrecord
            where book_copy_id = p_copy_id and status in ('borrowing', 'overdue', 'renewed')
            order by id desc limit 1;

            if v_borrow_id is not null then
                update borrowrecord
                set return_date = now(), status = 'returned',
                    notes = concat('图书丢失强制归还: ', ifnull(p_notes, ''))
                where id = v_borrow_id;
            end if;
        end if;

        update book_copies set status = 'lost' where id = p_copy_id;

        insert into inventoryrecord(book_copy_id, operator_id, operation_type, operation_date, notes)
        values(p_copy_id, p_operator_id, 'lost', now(), p_notes);

        commit;
    end if;
end//


-- ---------------------------------------------------------------------------
-- 存储过程 12：缴纳罚款 (sp_pay_fine)
--   参数：
--     IN  p_borrow_record_id - 借阅记录ID
--     IN  p_pay_amount       - 缴纳金额
--     IN  p_payment_method   - 缴费方式
--     IN  p_operator_id      - 收款操作员ID
--     OUT p_result_code      - 结果码(0=成功)
--     OUT p_result_message   - 结果消息
--   支持部分缴费：首次缴费自动创建罚单，后续累加已缴金额
-- ---------------------------------------------------------------------------
create procedure sp_pay_fine(
    in p_borrow_record_id int,
    in p_pay_amount decimal(10,2),
    in p_payment_method varchar(50),
    in p_operator_id int,
    out p_result_code int,
    out p_result_message varchar(100)
)
begin
    declare v_fine_id int;
    declare v_total_fine decimal(10,2);
    declare v_paid decimal(10,2);
    declare v_user_id int;

    set p_result_code = 0;
    set p_result_message = '缴费成功';

    -- 查找是否已有罚单
    select id, fine_amount, paid_amount into v_fine_id, v_total_fine, v_paid
    from fine where borrow_record_id = p_borrow_record_id;

    if v_fine_id is null then
        -- 首次缴费：从借阅记录创建罚单
        select overdue_fee into v_total_fine from borrowrecord where id = p_borrow_record_id;

        if v_total_fee is null or v_total_fee <= 0 then
            set p_result_code = 1;
            set p_result_message = '该借阅记录无逾期费用';
        else
            -- 查询关联用户
            select rc.user_id into v_user_id
            from borrowrecord br
            join reader_card rc on br.read_card_id = rc.id
            where br.id = p_borrow_record_id;

            insert into fine(user_id, borrow_record_id, fine_amount, paid_amount, status, paid_at, operator_id, notes)
            values(v_user_id, p_borrow_record_id, v_total_fine, p_pay_amount,
                   case when p_pay_amount >= v_total_fine then 'paid' else 'partial' end,
                   now(), p_operator_id, concat('缴费方式:', p_payment_method));
        end if;
    else
        -- 追加缴费
        if v_paid + p_pay_amount >= v_total_fine then
            update fine set paid_amount = paid_amount + p_pay_amount, status = 'paid',
                paid_at = now(), operator_id = p_operator_id
            where id = v_fine_id;
        else
            update fine set paid_amount = paid_amount + p_pay_amount, status = 'partial',
                paid_at = now(), operator_id = p_operator_id
            where id = v_fine_id;
        end if;
    end if;
end//


delimiter ;


-- ============================================================================
-- 定时任务：每日自动标记逾期借阅
--   每天凌晨2点执行 sp_check_overdue，将到期未还的记录标记为 overdue
--   要求 MySQL Event Scheduler 已开启：SET GLOBAL event_scheduler = ON;
-- ============================================================================
create event if not exists evt_check_overdue
on schedule every 1 day
starts concat(curdate(), ' 02:00:00')
on completion preserve
comment '每日自动检测逾期借阅记录'
do call sp_check_overdue();


-- ============================================================================
-- 默认系统配置数据
--   初始化 system_config 表的默认键值对
--   各存储过程会从该表读取配置，未配置时使用硬编码默认值
-- ============================================================================
insert into system_config(setting_key, setting_value, description) values
('borrow_days', '30', '默认借阅天数'),
('renew_days', '30', '续借延长的天数'),
('overdue_fine_rate', '1.00', '逾期费率(元/天)'),
('max_borrow_limit', '5', '默认最大借阅数量'),
('reservation_expire_days', '7', '预约默认有效天数');