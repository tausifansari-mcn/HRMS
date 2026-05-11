-- Allow managers to insert goals for their direct reports
CREATE POLICY "Managers insert team goals"
ON public.goals
FOR INSERT
TO authenticated
WITH CHECK (
  employee_id IN (
    SELECT e.id FROM public.employees e
    WHERE e.manager_id IN (
      SELECT e2.id FROM public.employees e2
      WHERE e2.user_id = auth.uid()
    )
  )
);

-- Allow managers to delete team goals
CREATE POLICY "Managers delete team goals"
ON public.goals
FOR DELETE
TO authenticated
USING (
  employee_id IN (
    SELECT e.id FROM public.employees e
    WHERE e.manager_id IN (
      SELECT e2.id FROM public.employees e2
      WHERE e2.user_id = auth.uid()
    )
  )
);