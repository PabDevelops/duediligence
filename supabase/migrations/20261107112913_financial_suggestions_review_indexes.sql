-- Cover review/history foreign keys without expanding client access.
create index financial_suggestions_reviewer on public.financial_data_suggestions(reviewed_by);
create index financial_suggestions_revision on public.financial_data_suggestions(override_revision_id);
