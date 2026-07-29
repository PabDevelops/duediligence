-- Weekly-review queue for the class of bug fixed on MNTN's marketCap: independent data sources
-- (Finnhub / Yahoo / SEC XBRL) disagreeing on a fact that should be a single number. Populated by
-- lib/dataAnomalies.js's flagDataAnomaly, read by app/api/admin/data-anomalies/route.js.
CREATE TABLE IF NOT EXISTS public.data_anomalies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticker text NOT NULL,
  field text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  pct_diff numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS data_anomalies_created_at_idx ON public.data_anomalies (created_at DESC);
CREATE INDEX IF NOT EXISTS data_anomalies_ticker_idx ON public.data_anomalies (ticker);
-- Plain (not partial) unique index: re-flagging the same ticker+field just overwrites the
-- existing row (via upsert) and clears reviewed_at, rather than piling up duplicate rows.
CREATE UNIQUE INDEX IF NOT EXISTS data_anomalies_ticker_field_idx ON public.data_anomalies (ticker, field);

ALTER TABLE public.data_anomalies ENABLE ROW LEVEL SECURITY;
