-- Create storage policies for employee-documents bucket

-- Allow admin/HR to upload documents
CREATE POLICY "Admin/HR can upload employee documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents' 
  AND public.is_admin_or_hr(auth.uid())
);

-- Allow admin/HR to view all documents
CREATE POLICY "Admin/HR can view employee documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'employee-documents' 
  AND public.is_admin_or_hr(auth.uid())
);

-- Allow employees to view their own documents
CREATE POLICY "Employees can view own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.employees WHERE user_id = auth.uid()
  )
);

-- Allow admin/HR to delete documents
CREATE POLICY "Admin/HR can delete employee documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-documents' 
  AND public.is_admin_or_hr(auth.uid())
);

-- Allow admin/HR to update documents
CREATE POLICY "Admin/HR can update employee documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'employee-documents' 
  AND public.is_admin_or_hr(auth.uid())
);