from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.units import inch
import json, hashlib, datetime, csv
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'data/products/product_catalog.json').read_text())
out=root/'product-builds/releases'; out.mkdir(parents=True,exist_ok=True)
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='CenterTitle',parent=styles['Title'],alignment=TA_CENTER,fontSize=25,leading=29,spaceAfter=16,textColor=colors.HexColor('#2E2925')))
styles.add(ParagraphStyle(name='Kicker',parent=styles['BodyText'],alignment=TA_CENTER,fontSize=8,leading=10,textColor=colors.HexColor('#776E67'),spaceAfter=8))
styles.add(ParagraphStyle(name='Small',parent=styles['BodyText'],fontSize=8,leading=11,textColor=colors.HexColor('#555555')))
styles.add(ParagraphStyle(name='Section',parent=styles['Heading1'],fontSize=17,leading=21,textColor=colors.HexColor('#2E2925'),spaceAfter=10))
styles.add(ParagraphStyle(name='Prompt',parent=styles['BodyText'],fontSize=9,leading=13,textColor=colors.HexColor('#443D38')))

sections={
'seating-chart-maker':[
 ('Guest Master List',['Guest name','Household/group','RSVP status','Meal choice','Allergy or dietary note','Accessibility need','Child/high chair','VIP/family note','Table assignment','Confirmed by']),
 ('Table Inventory',['Table number/name','Shape','Maximum capacity','Reserved seats','Assigned count','Remaining seats','Placement note']),
 ('Social Group Map',['Group name','People included','Keep together','Separate from','Placement priority','Notes']),
 ('Unassigned Guest Reconciliation',['Confirmed guest','Reason unassigned','Decision owner','Resolution deadline','Final table']),
 ('Venue Handoff',['Table','Capacity','Assigned guests','Special meals','Accessibility needs','Children/high chairs','Venue note']),
 ('Caterer Handoff',['Guest','Table','Meal','Allergy/dietary note','Confirmed']),
 ('Escort Card Export',['Display name','Table','Meal marker','Accessibility note','Printed/ordered']),
 ('Late Change Log',['Date','Guest/change','Old assignment','New assignment','Who was notified','Finalized by'])],
'budget-spreadsheet':[
 ('Budget Control Summary',['Category','Target','Estimated','Contracted','Paid','Remaining','Variance','Owner']),
 ('Vendor Cost Register',['Vendor','Category','Proposal','Contracted total','Tax','Service fee','Delivery/setup','Overtime','Gratuity','True total']),
 ('Payment Calendar',['Vendor','Deposit due','Deposit amount','Progress payment','Final due','Final amount','Paid status','Payment method']),
 ('Family Contributions',['Contributor','Pledged','Received','Restricted category','Allocated','Remaining','Notes']),
 ('Monthly Cash Flow',['Month','Starting cash','Contributions expected','Vendor payments due','Other costs','Ending cash need']),
 ('Hidden Cost Review',['Potential cost','Expected?','Estimate','Confirmed amount','Due date','Owner']),
 ('Scenario Comparison',['Scenario','Guest count','Venue/catering','Other categories','Contingency','Total','Difference']),
 ('Final Reconciliation',['Budget','Total contracted','Total paid','Remaining due','Contingency remaining','Projected final'])],
'timeline-template':[
 ('Master Day Timeline',['Time','Location','Event/action','Owner','People involved','Dependency','Buffer','Confirmed']),
 ('Vendor Arrival Schedule',['Vendor','Contact','Arrival','Setup start','Ready by','Breakdown','Departure','Handoff owner']),
 ('Couple Timeline',['Time','Partner 1','Partner 2','Location','Transportation','Required items']),
 ('Wedding Party Timeline',['Time','Group/member','Action','Location','Owner/contact','Required items']),
 ('Photography Timeline',['Time','Photo block','People needed','Location','Duration','Must finish before']),
 ('Family Photo Groupings',['Group number','People','Meeting point','Call time','Photo order','Released by']),
 ('Setup and Breakdown',['Item/area','Delivery','Setup owner','Ready by','Breakdown owner','Pickup/return']),
 ('Emergency Contacts',['Role','Name','Phone','Backup','Authority/decision area']),
 ('Change Control',['Change','Impact','Decision owner','People notified','Final version time'])],
'checklist-pdf':[
 ('Planning Profile',['Wedding date','Planning start','Guest count','Venue status','Local/destination','Planner/DIY','Events included']),
 ('Critical Path',['Task','Why it is critical','Target date','Dependency','Owner','Status']),
 ('12-9 Months',['Task','Deadline','Owner','Dependency','Status','Notes']),
 ('8-6 Months',['Task','Deadline','Owner','Dependency','Status','Notes']),
 ('5-3 Months',['Task','Deadline','Owner','Dependency','Status','Notes']),
 ('2-1 Months',['Task','Deadline','Owner','Dependency','Status','Notes']),
 ('Wedding Week',['Task','Date/time','Owner','Handoff to','Confirmed']),
 ('Final Payments',['Vendor','Amount','Due','Payment method','Owner','Paid/receipt']),
 ('Responsibility Matrix',['Workstream','Primary owner','Backup','Decision authority','Handoff date']),
 ('Post-Wedding Closeout',['Task','Deadline','Owner','Receipt/return','Complete'])],
'operations-suite':[
 ('Suite Control Center',['Workstream','Current status','Next decision','Owner','Deadline','Related product']),
 ('Venue Comparison',['Venue','Capacity','Base fee','Food/beverage','Service/tax','Rentals','True estimate','Decision']),
 ('Vendor Contact Register',['Category','Vendor','Contact','Contract status','Next payment','Final handoff','Notes']),
 ('Wedding Responsibility Matrix',['Workstream','Primary owner','Backup','Decision authority','Deadline','Status']),
 ('Wedding Week Handoff',['Date/time','Action','Owner','Recipient','File/item','Confirmed']),
 ('Emergency Contact Pack',['Role','Name','Phone','Backup','Decision area']),
 ('Final Readiness Review',['Area','Ready?','Outstanding issue','Owner','Deadline','Final proof'])]
}

def notice(p):
 return [Paragraph(p['name'],styles['CenterTitle']),Paragraph('A Dream Wedding Builder product',styles['Kicker']),Paragraph('<b>Personal-use license and important limits</b>',styles['Section']),Paragraph('Copyright 2026 Dream Wedding Builder. Licensed to the purchaser for personal use only. Do not resell, redistribute, sublicense, publish, share publicly, or repackage this product as a template.',styles['BodyText']),Spacer(1,8),Paragraph('This product is an educational and organizational aid. It is not legal, financial, tax, insurance, safety, accessibility, venue, dietary, medical, or professional wedding-planning advice. Verify all deadlines, prices, contracts, capacities, allergies, accessibility needs, local rules, vendor requirements, and event details with the relevant qualified professionals and providers. No outcome, savings, availability, accuracy, completeness, or vendor performance is guaranteed.',styles['BodyText']),Spacer(1,8),Paragraph('The purchaser is responsible for confirming the final information before sharing it with a venue, vendor, guest, family member, wedding party member, or other third party.',styles['BodyText']),Spacer(1,10),Paragraph('Support: info@weddingchecklistpdf.com | Version 2.0.0 | Effective 2026-07-10',styles['Small']),PageBreak()]

def make_table(title, cols, rows=12):
 data=[[Paragraph(c,styles['Small']) for c in cols]]
 for _ in range(rows): data.append(['' for _ in cols])
 width=7.2*inch/len(cols)
 t=Table(data,colWidths=[width]*len(cols),repeatRows=1,rowHeights=[.34*inch]+[.36*inch]*rows)
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E9DDD0')),('TEXTCOLOR',(0,0),(-1,0),colors.HexColor('#2E2925')),('GRID',(0,0),(-1,-1),.45,colors.HexColor('#A79A90')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
 return [Paragraph(title,styles['Section']),Paragraph('Complete this working page using verified information. Mark unresolved items clearly and name the person responsible for the next decision.',styles['Prompt']),Spacer(1,8),t,PageBreak()]

manifest={'version':'2.0.0','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'products':[]}
for p in catalog['products']:
 fname=f"{p['sku']}_v2.0.0.pdf"; path=out/fname
 doc=SimpleDocTemplate(str(path),pagesize=letter,rightMargin=.4*inch,leftMargin=.4*inch,topMargin=.45*inch,bottomMargin=.45*inch)
 story=notice(p)
 story += [Paragraph('How to use this product',styles['Section']),Paragraph('Work from confirmed information. Keep assumptions visibly separate. Assign one owner to every unresolved item. Before the final handoff, reconcile totals, capacities, dates, dependencies, and contact information. Share one final version and keep a change log when updates occur.',styles['BodyText']),Spacer(1,12),Paragraph('Included working sections',styles['Section'])]
 for title,cols in sections[p['id']]: story.append(Paragraph('• '+title,styles['BodyText'])); story.append(Spacer(1,4))
 story.append(PageBreak())
 for title,cols in sections[p['id']]: story += make_table(title,cols,10 if len(cols)>7 else 12)
 story += [Paragraph('Final verification and release',styles['Section']),Paragraph('Do not distribute the final plan until each applicable item below is confirmed.',styles['BodyText']),Spacer(1,12)]
 checks=['Names and contact information checked','Dates, times, travel, setup and breakdown checked','Prices, taxes, fees, gratuities and payment terms checked','Venue capacities, layouts and rules checked','Dietary, allergy, accessibility and child needs checked','Contracts and vendor requirements checked','One final version named and shared','Change owner and backup identified']
 for c in checks: story += [Paragraph('□ '+c,styles['BodyText']),Spacer(1,7)]
 doc.build(story)
 digest=hashlib.sha256(path.read_bytes()).hexdigest()
 files=[{'path':fname,'sha256':digest,'content_type':'application/pdf','delivery':'private-r2-required'}]
 # CSV starter for tabular portability
 csv_name=f"{p['sku']}_starter_v2.0.0.csv"; csv_path=out/csv_name
 first_title,first_cols=sections[p['id']][0]
 with csv_path.open('w',newline='',encoding='utf-8') as f: csv.writer(f).writerow(first_cols)
 files.append({'path':csv_name,'sha256':hashlib.sha256(csv_path.read_bytes()).hexdigest(),'content_type':'text/csv','delivery':'private-r2-required'})
 manifest['products'].append({'product_id':p['id'],'sku':p['sku'],'version':'2.0.0','files':files})
(root/'product-builds/manifests').mkdir(parents=True,exist_ok=True)
(root/'product-builds/manifests/download_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f"Generated {len(manifest['products'])} canonical product packages")
