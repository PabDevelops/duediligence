alter table blog_posts add column if not exists author text not null default 'Traqcker Team';
update blog_posts set author = 'Traqcker Team' where author is null or author = '';
