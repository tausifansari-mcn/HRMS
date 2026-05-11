DROP POLICY IF EXISTS "Anyone can view company events" ON public.company_events;

CREATE POLICY "Authenticated users can view company events"
ON public.company_events
FOR SELECT
TO authenticated
USING (true);