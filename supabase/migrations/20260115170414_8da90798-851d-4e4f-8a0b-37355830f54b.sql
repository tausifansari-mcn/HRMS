-- Add working hours and days columns to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS working_hours_start TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS working_hours_end TIME DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS working_days INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5];

-- Add comment to explain working_days format
COMMENT ON COLUMN public.employees.working_days IS 'Array of weekday numbers: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';

-- Add notification preference for attendance reminders
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS attendance_reminder_notifications BOOLEAN DEFAULT true;