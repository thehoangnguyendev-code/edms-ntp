const fs = require('fs');
const files = [
  'src/features/documents/document-list/DocumentsView.tsx',
  'src/features/documents/document-revisions/views/RevisionListView.tsx',
  'src/features/documents/document-revisions/views/RevisionsOwnedByMeView.tsx',
  'src/features/documents/document-revisions/views/PendingDocumentsView.tsx',
  'src/features/documents/controlled-copies/ControlledCopiesView.tsx',
  'src/features/documents/archived-documents/ArchivedDocumentsView.tsx',
  'src/features/training/materials/views/material-list/MaterialsView.tsx',
  'src/features/training/course-inventory/courses/CourseListView.tsx',
  'src/features/training/course-inventory/courses/pending-review/PendingReviewView.tsx',
  'src/features/training/course-inventory/courses/pending-approval/PendingApprovalView.tsx',
  'src/features/training/compliance-tracking/views/matrix/TrainingMatrixView.tsx',
  'src/features/training/compliance-tracking/views/course-status/CourseStatusView.tsx',
  'src/features/settings/user-management/views/UserManagementView.tsx',
  'src/features/training/compliance-tracking/views/course-progress/CourseProgressView.tsx',
  'src/features/training/materials/views/material-report/UsageReportView.tsx',
  'src/features/training/compliance-tracking/views/result-entry/ResultEntryView.tsx'
];

let changedCount = 0;
const scrollbarClasses = 'scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 hover:scrollbar-thumb-slate-400 scrollbar-thumb-rounded-full scrollbar-track-rounded-full';

for (const filepath of files) {
  if (!fs.existsSync(filepath)) {
    console.log('Skipping (not found):', filepath);
    continue;
  }
  let content = fs.readFileSync(filepath, 'utf8');
  let originalContent = content;
  
  // Replace direct className
  const regex = /className=[\"']([^\"']*overflow-x-auto[^\"']*)[\"']/g;
  content = content.replace(regex, (match, classes) => {
    if (classes.includes('scrollbar-thin')) return match;
    return 'className=\"' + classes + ' ' + scrollbarClasses + '\"';
  });

  // Replace utility classes injected via cn()
  const cnRegex = /cn\(\s*[\"']([^\"']*overflow-x-auto[^\"']*)[\"']/g;
  content = content.replace(cnRegex, (match, classes) => {
    if (classes.includes('scrollbar-thin')) return match;
    return 'cn(\"' + classes + ' ' + scrollbarClasses + '\"';
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filepath, content);
    console.log('Updated:', filepath);
    changedCount++;
  } else {
    console.log('No changes needed:', filepath);
  }
}
console.log('Done! Updated ' + changedCount + ' files.');
