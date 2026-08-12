UPDATE storage_locations
SET description = 'Office Online workspace storage',
    updated_at = NOW()
WHERE name = 'Digital Document Repository'
  AND description = 'SharePoint online storage';
