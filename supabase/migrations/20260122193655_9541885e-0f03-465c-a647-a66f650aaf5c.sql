-- Allow managers to update their direct reports' goals
CREATE POLICY "Managers update team goals"
ON public.goals
FOR UPDATE
USING (
  employee_id IN (
    SELECT id FROM employees
    WHERE manager_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  employee_id IN (
    SELECT id FROM employees
    WHERE manager_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  )
);