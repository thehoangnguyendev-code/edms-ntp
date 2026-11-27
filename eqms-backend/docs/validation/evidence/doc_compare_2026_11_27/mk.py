import docx, sys
def mk(p, v2):
    d = docx.Document()
    d.sections[0].header.paragraphs[0].text = "SOP test header {{REVISION_NUMBER}}"
    d.add_heading("Quy trình vệ sinh thiết bị", 1)
    d.add_paragraph("Mục đích: hướng dẫn vệ sinh thiết bị." if not v2 else "Mục đích: hướng dẫn vệ sinh và khử trùng thiết bị.")
    d.add_paragraph("Bước 1: Ngắt nguồn điện.", style="List Number")
    if v2: d.add_paragraph("Bước 1b: Treo biển đang vệ sinh.", style="List Number")
    d.add_paragraph("Bước 2: Tháo các bộ phận.", style="List Number")
    if not v2: d.add_paragraph("Đoạn này sẽ bị xoá ở bản mới.")
    t = d.add_table(rows=2, cols=2); t.style="Table Grid"
    for r,(a,b) in enumerate([("Hoá chất","Nồng độ"),("Cồn", "90%" if v2 else "70%")]):
        t.cell(r,0).text=a; t.cell(r,1).text=b
    d.save(p)
mk(sys.argv[1]+"/old.docx", False); mk(sys.argv[1]+"/new.docx", True)
