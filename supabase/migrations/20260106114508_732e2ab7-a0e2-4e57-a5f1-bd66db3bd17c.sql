-- Fix Security Issue 1: Restrict activity logs insertion to service role only
-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;

-- Create a more restrictive policy - only service role can insert logs
-- Edge functions use service role, so they can still insert
CREATE POLICY "Service role can insert logs" 
ON public.activity_logs 
FOR INSERT TO service_role
WITH CHECK (true);

-- Fix Security Issue 2: Drop the overly permissive team directory policy
-- This policy exposes all employee personal data to any authenticated user
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;