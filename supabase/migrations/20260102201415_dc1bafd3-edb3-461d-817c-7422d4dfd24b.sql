-- Allow all authenticated users to view employees (team directory)
CREATE POLICY "Authenticated users can view employees"
ON public.employees
FOR SELECT
USING (auth.uid() IS NOT NULL);