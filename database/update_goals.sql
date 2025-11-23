-- Add columns to goals table to support UI requirements
ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS allocated_amount numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS color text DEFAULT '#FF88B7';
