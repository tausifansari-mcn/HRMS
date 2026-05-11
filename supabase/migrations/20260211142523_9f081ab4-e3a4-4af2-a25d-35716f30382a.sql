
-- Create table for KPI ratings within performance reviews
CREATE TABLE public.review_kpi_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  employee_rating integer,
  manager_rating integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, goal_id)
);

-- Enable RLS
ALTER TABLE public.review_kpi_ratings ENABLE ROW LEVEL SECURITY;

-- Employees can view their own KPI ratings (via review's employee_id)
CREATE POLICY "Employees view own KPI ratings"
ON public.review_kpi_ratings
FOR SELECT
USING (
  review_id IN (
    SELECT id FROM public.performance_reviews
    WHERE employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  )
);

-- Employees can insert/update their own ratings (employee_rating only)
CREATE POLICY "Employees rate own KPIs"
ON public.review_kpi_ratings
FOR INSERT
WITH CHECK (
  review_id IN (
    SELECT id FROM public.performance_reviews
    WHERE employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Employees update own KPI ratings"
ON public.review_kpi_ratings
FOR UPDATE
USING (
  review_id IN (
    SELECT id FROM public.performance_reviews
    WHERE employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  )
);

-- Managers can view/insert/update KPI ratings for their team's reviews
CREATE POLICY "Managers view team KPI ratings"
ON public.review_kpi_ratings
FOR SELECT
USING (
  review_id IN (
    SELECT id FROM public.performance_reviews
    WHERE employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.manager_id IN (
        SELECT e2.id FROM public.employees e2 WHERE e2.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Managers insert team KPI ratings"
ON public.review_kpi_ratings
FOR INSERT
WITH CHECK (
  review_id IN (
    SELECT id FROM public.performance_reviews
    WHERE employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.manager_id IN (
        SELECT e2.id FROM public.employees e2 WHERE e2.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Managers update team KPI ratings"
ON public.review_kpi_ratings
FOR UPDATE
USING (
  review_id IN (
    SELECT id FROM public.performance_reviews
    WHERE employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.manager_id IN (
        SELECT e2.id FROM public.employees e2 WHERE e2.user_id = auth.uid()
      )
    )
  )
);

-- Admin/HR full access
CREATE POLICY "Admin/HR manage KPI ratings"
ON public.review_kpi_ratings
FOR ALL
USING (is_admin_or_hr(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_review_kpi_ratings_updated_at
BEFORE UPDATE ON public.review_kpi_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger for ratings (1-5)
CREATE TRIGGER validate_review_kpi_ratings_trigger
BEFORE INSERT OR UPDATE ON public.review_kpi_ratings
FOR EACH ROW
EXECUTE FUNCTION public.validate_goal_ratings();
