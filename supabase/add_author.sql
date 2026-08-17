alter table blog_posts add column if not exists author text not null default 'Bulltrace Team';
update blog_posts set author = 'Bulltrace Team' where author is null or author = '';
