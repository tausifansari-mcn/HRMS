-- Add acknowledgment fields to performance_reviews table
ALTER TABLE public.performance_reviews
ADD COLUMN acknowledged_at timestamp with time zone,
ADD COLUMN acknowledged_by uuid;

-- Add comment for clarity
COMMENT ON COLUMN public.performance_reviews.acknowledged_at IS 'When the employee acknowledged the review';
COMMENT ON COLUMN public.performance_reviews.acknowledged_by IS 'User ID who acknowledged (should match employee user_id)';