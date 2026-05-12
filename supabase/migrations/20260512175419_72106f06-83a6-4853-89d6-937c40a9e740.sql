DROP INDEX IF EXISTS public.orders_business_invoice_idx;
ALTER TABLE public.orders DROP COLUMN IF EXISTS invoice_number;