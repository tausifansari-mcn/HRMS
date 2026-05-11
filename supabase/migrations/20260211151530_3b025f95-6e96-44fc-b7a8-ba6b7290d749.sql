CREATE POLICY "Managers delete team draft reviews"
ON public.performance_reviews
FOR DELETE
USING (
  status = 'draft'
  AND employee_id IN (
    SELECT e.id FROM employees e
    WHERE e.manager_id IN (
      SELECT e2.id FROM employees e2
      WHERE e2.user_id = auth.uid()
    )
  )
  AND reviewer_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
);