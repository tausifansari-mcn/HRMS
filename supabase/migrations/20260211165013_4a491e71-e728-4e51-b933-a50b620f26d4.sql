
-- Create attendance_breaks table
CREATE TABLE public.attendance_breaks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_record_id uuid NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  pause_time timestamptz NOT NULL DEFAULT now(),
  resume_time timestamptz,
  pause_latitude numeric,
  pause_longitude numeric,
  pause_location_name text,
  resume_latitude numeric,
  resume_longitude numeric,
  resume_location_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_breaks ENABLE ROW LEVEL SECURITY;

-- Employees manage their own breaks (via attendance_record ownership)
CREATE POLICY "Employees manage own breaks"
ON public.attendance_breaks
FOR ALL
USING (
  attendance_record_id IN (
    SELECT ar.id FROM public.attendance_records ar
    WHERE ar.employee_id IN (
      SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()
    )
  )
);

-- Admin/HR manage all breaks
CREATE POLICY "Admin/HR manage all breaks"
ON public.attendance_breaks
FOR ALL
USING (is_admin_or_hr(auth.uid()));

-- Managers view team breaks
CREATE POLICY "Managers view team breaks"
ON public.attendance_breaks
FOR SELECT
USING (
  attendance_record_id IN (
    SELECT ar.id FROM public.attendance_records ar
    WHERE ar.employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.manager_id IN (
        SELECT e2.id FROM public.employees e2 WHERE e2.user_id = auth.uid()
      )
    )
  )
);

-- Index for performance
CREATE INDEX idx_attendance_breaks_record_id ON public.attendance_breaks(attendance_record_id);
