
-- Add employee_rating and manager_rating columns to goals table
ALTER TABLE public.goals
  ADD COLUMN employee_rating integer,
  ADD COLUMN manager_rating integer;

-- Add check constraints via trigger for rating validation (1-5)
CREATE OR REPLACE FUNCTION public.validate_goal_ratings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.employee_rating IS NOT NULL AND (NEW.employee_rating < 1 OR NEW.employee_rating > 5) THEN
    RAISE EXCEPTION 'employee_rating must be between 1 and 5';
  END IF;
  IF NEW.manager_rating IS NOT NULL AND (NEW.manager_rating < 1 OR NEW.manager_rating > 5) THEN
    RAISE EXCEPTION 'manager_rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_goal_ratings_trigger
BEFORE INSERT OR UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.validate_goal_ratings();
