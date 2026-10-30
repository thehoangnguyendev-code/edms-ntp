# Runs the Training evidence scripts that map to SOP.0003, one after the other, and writes one result line for each to sop_evidence_run.log.
# The DEV password is read from the environment variable DEVPW; it is not written anywhere. DEV only: the scripts create E2E-TEST records.
#
#   $env:DEVPW = '<the DEV password>'       # type it yourself in your own terminal
#   cd eqms-backend\docs\validation\evidence\training_2026_10_18
#   .\run_sop_evidence.ps1                  # API scripts only
#   .\run_sop_evidence.ps1 -Ui              # also the scripts that open Edge (Playwright)
#   .\run_sop_evidence.ps1 -Only e2e47      # one script
param([switch]$Ui, [string]$Only = '')

if (-not $env:DEVPW) { Write-Error 'Set the environment variable DEVPW first (see the top of this file).'; exit 2 }

# script, SOP.0003 clause it is evidence for
$api = @(
  @('e2e21_matrix.py',                  '5.1, 5.1.2: kinds, reasons, methods, assessments, results'),
  @('e2e16_content_rules.py',           '5.3.5: materials and assessment form by case'),
  @('e2e18_lifecycle_qa_supplementary.py', '5.3.6, 5.3.7: whole life, send to QA, supplementary training'),
  @('e2e20_start_and_signatures.py',    '5.3.6: start and signatures of the changes of state'),
  @('e2e22_notifications.py',           '5.3.6: who is told what, in the application and by e-mail'),
  @('e2e23_flows.py',                   '5.3.3, 5.3.7: cancel, postpone, reopen, list locked, segregation'),
  @('e2e24_document_to_completion.py',  '5.1.3, 5.3.6: training that starts from a document'),
  @('e2e26_roles.py',                   '5.3.3: who may do what (limited accounts)'),
  @('e2e29_related_documents_one_number.py', '5.1.4: one number for related documents'),
  @('e2e31_attendance_then_complete_training.py', '5.3.6: attendance, list to QA, complete'),
  @('e2e32_trainer_confirms_attendance.py', '5.3.6, 5.3.7: trainer sends list, finishes, sends results'),
  @('e2e27_attendance_list_apd0117.py', '5.3.4, 5.3.7: APD.0117 filled (item 3.1 is a known failure)'),
  @('e2e33_assessment_library.py',      '5.3.5: library of assessments, approval with signature'),
  @('e2e34_apd0009_form_flow.py',       '5.1.2, 5.3.7: APD.0009 form and the result'),
  @('e2e35_matrix_form_apd0011.py',     '5.3.1: matrix form APD.0011'),
  @('e2e36_company_forms.py',           '5.3.2, 5.3.4, 6: APD.0118, APD.0108, FRM.0044'),
  @('e2e37_paper_copy_status.py',       '5.3.10: numbered paper copies'),
  @('e2e38_paper_prints_of_forms.py',   '5.3.7, 5.3.8: paper prints APD.0024, APD.0108'),
  @('e2e39_training_vendors.py',        '5.1 (SOP.0025): approved training vendors'),
  @('e2e41_specimen_beside_scan.py',    '5.3.9: specimen beside a scan'),
  @('e2e42_specimen_three_states.py',   '5.3.9: three states of a specimen'),
  @('e2e43_job_roles.py',               '5.3.8: Work Positions and job assignment'),
  @('e2e44_required_for_all.py',        '5.3.1: required for all employees'),
  @('e2e46_all_employees_compliance.py','5.3.1: column All employees and compliance'),
  @('e2e47_sop_checks.py',              '5.3.7: days to send results, other SOP points'),
  @('e2e48_assessment_layout.py',       '5.3.7: layout of an assessment'),
  @('e2e49_code_rules_hybrid.py',       '5.1.4: code rules, hybrid')
)
# e2e50 without APPLY=1 only checks the refusals; it never adds drafts to the matrices.
$api += ,@('e2e50_apply_locked_rows.py', '5.3.1: locked rows (refusals only)')
$ui = @(
  @('e2e19_ui.py',                      'screens changed on 2026-10-23'),
  @('e2e25_complete_training_button_ui.py', 'Complete Training (Revision) button'),
  @('e2e28_attendance_list_ui.py',      'attendance list window'),
  @('e2e30_checkin_signature_ui.py',    'check-in with the code and a signature')
)

$list = $api; if ($Ui) { $list += $ui }
if ($Only) { $list = $list | Where-Object { $_[0] -like "$Only*" } }
$log = Join-Path $PSScriptRoot 'sop_evidence_run.log'
"Run $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Encoding utf8
Push-Location $PSScriptRoot
foreach ($item in $list) {
  $script = $item[0]; $clause = $item[1]
  Write-Host "== $script ($clause)"
  $out = & python $script 2>&1 | Out-String
  $code = $LASTEXITCODE
  $summary = ($out -split "`n" | Where-Object { $_ -match 'checks passed|Traceback|Error|FAIL' } | Select-Object -Last 2) -join ' | '
  $line = "{0,-45} exit={1} {2}" -f $script, $code, $summary.Trim()
  $line | Tee-Object -FilePath $log -Append
}
Pop-Location
Write-Host "`nResult lines: $log"
