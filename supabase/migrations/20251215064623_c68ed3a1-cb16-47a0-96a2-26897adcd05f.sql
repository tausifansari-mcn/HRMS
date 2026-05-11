-- Allow employees to update their own contact information
CREATE POLICY "Employees can update own contact info"
ON public.employees
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());