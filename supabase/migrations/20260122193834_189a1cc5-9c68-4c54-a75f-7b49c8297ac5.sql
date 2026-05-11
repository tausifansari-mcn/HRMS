-- Allow managers to create reviews for their direct reports
CREATE POLICY "Managers create team reviews"
ON public.performance_reviews
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT id FROM employees
    WHERE manager_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  )
);

-- Allow managers to update reviews they created for their team
CREATE POLICY "Managers update team reviews"
ON public.performance_reviews
FOR UPDATE
USING (
  employee_id IN (
    SELECT id FROM employees
    WHERE manager_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  )
  AND reviewer_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
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