"""Builds the three Dream Wedding Builder book kits (printable PDFs) for review.

Brand: ivory #FAF7F2, midnight #1B1F3B, blue #2747D9 (one accent), coral #F28C6B (tabs only).
Serif headings (Times, closest built-in to Instrument Serif), sans body (Helvetica).
"""
import sys
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

IVORY, MID, BLUE, CORAL, LINE, MUTED = (HexColor(x) for x in ("#FAF7F2", "#1B1F3B", "#2747D9", "#F28C6B", "#C9C3B8", "#5A5E73"))
W, H = letter
M = 0.75 * inch
VERSION = "1.0.0"


class Doc:
    def __init__(self, path, name, sku):
        self.c = canvas.Canvas(str(path), pagesize=letter, invariant=1, pageCompression=1)
        self.c.setTitle(name); self.c.setAuthor("Dream Wedding Builder"); self.c.setSubject(name)
        self.name, self.sku, self.page = name, sku, 0
        self.y = H - M

    # ---------- page furniture ----------
    def new_page(self, title=None, kicker=None):
        if self.page:
            self.c.showPage()
        self.page += 1
        c = self.c
        c.setFillColor(IVORY); c.rect(0, 0, W, H, stroke=0, fill=1)
        # binder tabs (logo motif) top right
        c.setFillColor(CORAL); c.roundRect(W - M - 34, H - 0.55 * inch, 26, 16, 3, stroke=0, fill=1)
        c.setFillColor(BLUE); c.roundRect(W - M - 22, H - 0.47 * inch, 26, 16, 3, stroke=0, fill=1)
        c.setFillColor(MUTED); c.setFont("Helvetica", 8)
        c.drawString(M, 0.45 * inch, f"{self.name} · Dream Wedding Builder · weddingchecklistpdf.com")
        c.drawRightString(W - M, 0.45 * inch, f"Page {self.page}")
        self.y = H - M - 10
        if kicker:
            c.setFont("Courier", 8.5); c.setFillColor(BLUE); c.drawString(M, self.y, kicker.upper()); self.y -= 22
        if title:
            self.heading(title, 26)

    def heading(self, text, size=18, gap=10):
        c = self.c
        c.setFillColor(MID); c.setFont("Times-Roman", size)
        for line in self.wrap(text, "Times-Roman", size, W - 2 * M):
            c.drawString(M, self.y, line); self.y -= size * 1.15
        self.y -= gap

    def wrap(self, text, font, size, width):
        words, lines, cur = text.split(), [], ""
        for w in words:
            t = (cur + " " + w).strip()
            if self.c.stringWidth(t, font, size) <= width:
                cur = t
            else:
                lines.append(cur); cur = w
        if cur:
            lines.append(cur)
        return lines

    def para(self, text, size=11, color=MID, font="Helvetica", gap=8, indent=0, lh=1.4):
        c = self.c
        c.setFillColor(color); c.setFont(font, size)
        for line in self.wrap(text, font, size, W - 2 * M - indent):
            c.drawString(M + indent, self.y, line); self.y -= size * lh
        self.y -= gap

    def note(self, text):
        self.para(text, 9.5, MUTED, "Helvetica-Oblique", 10)

    def checklist(self, items, size=11, box=True, date_col=False):
        c = self.c
        for it in items:
            if box:
                c.setStrokeColor(MID); c.setLineWidth(0.8); c.rect(M, self.y - 2, 10, 10, stroke=1, fill=0)
            width = W - 2 * M - 20 - (90 if date_col else 0)
            lines = self.wrap(it, "Helvetica", size, width)
            c.setFillColor(MID); c.setFont("Helvetica", size)
            for i, line in enumerate(lines):
                c.drawString(M + 20, self.y, line)
                if i == 0 and date_col:
                    c.setStrokeColor(LINE); c.line(W - M - 80, self.y - 2, W - M, self.y - 2)
                self.y -= size * 1.35
            self.y -= 6

    def lines(self, n, gap=24):
        c = self.c
        c.setStrokeColor(LINE); c.setLineWidth(0.6)
        for _ in range(n):
            self.y -= gap
            c.line(M, self.y, W - M, self.y)
        self.y -= 14

    def prompt(self, q, n=2):
        self.para(q, 11, MID, "Helvetica-Bold", 0)
        self.lines(n, 22)

    def table(self, cols, rows, widths=None, row_h=26, prefill=None):
        c = self.c
        total = W - 2 * M
        widths = widths or [total / len(cols)] * len(cols)
        k = total / sum(widths); widths = [w * k for w in widths]
        x0 = M
        c.setFillColor(HexColor("#ECE6DB")); c.rect(M, self.y - 20, total, 24, stroke=0, fill=1)
        c.setFillColor(MID); c.setFont("Helvetica-Bold", 9.5)
        x = x0
        for col, w in zip(cols, widths):
            c.drawString(x + 4, self.y - 13, col); x += w
        self.y -= 20
        c.setStrokeColor(LINE); c.setLineWidth(0.6)
        for r in range(rows):
            top = self.y
            self.y -= row_h
            c.line(M, self.y, M + total, self.y)
            if prefill and r < len(prefill):
                c.setFont("Helvetica", 9.5); c.setFillColor(MID)
                x = x0
                for cell, w in zip(prefill[r], widths):
                    if cell:
                        c.drawString(x + 4, top - 16, cell)
                    x += w
        x = x0
        for w in widths[:-1]:
            x += w; c.line(x, self.y, x, self.y + 20 + rows * row_h)
        self.y -= 16

    def cover(self, title, subtitle, contents):
        c = self.c
        self.page += 1
        c.setFillColor(IVORY); c.rect(0, 0, W, H, stroke=0, fill=1)
        c.setFillColor(CORAL); c.roundRect(M, H - 2.1 * inch, 70, 44, 6, stroke=0, fill=1)
        c.setFillColor(BLUE); c.roundRect(M + 26, H - 1.9 * inch, 70, 44, 6, stroke=0, fill=1)
        c.setFillColor(MID); c.setFont("Times-Roman", 30); c.drawString(M, H - 2.75 * inch, "Dream")
        c.setFont("Times-Italic", 30); c.drawString(M + c.stringWidth("Dream ", "Times-Roman", 30), H - 2.75 * inch, "Wedding")
        c.setFont("Helvetica", 9); c.drawString(M + 2, H - 2.95 * inch, "B U I L D E R")
        self.y = H - 4.2 * inch
        self.heading(title, 44, 6)
        self.para(subtitle, 15, MID, "Times-Italic", 22)
        c.setFont("Courier", 9); c.setFillColor(BLUE); c.drawString(M, self.y, "WHAT IS INSIDE"); self.y -= 18
        for it in contents:
            c.setFillColor(MID); c.setFont("Helvetica", 11); c.drawString(M, self.y, "—  " + it); self.y -= 16
        c.setFont("Helvetica", 8.5); c.setFillColor(MUTED)
        c.drawString(M, 0.7 * inch, f"Printable kit · {self.sku} · Version {VERSION} · weddingchecklistpdf.com")

    def license_page(self, extra):
        self.new_page("Before you start", "How to use this kit")
        for p in extra:
            self.para(p)
        self.heading("Personal-use license and limits", 15, 6)
        self.para("Copyright 2026 Dream Wedding Builder. Licensed to the purchaser for personal use. Print as many copies as you need for your own wedding. Do not resell, share publicly or repackage it as a template.", 10)
        self.para("This kit is an organizing aid. It is not legal, financial or professional wedding-planning advice. Rules, fees and requirements differ by place and change over time: confirm every one with the office or vendor responsible before you rely on it.", 10)
        self.para("Questions: info@weddingchecklistpdf.com", 10, MUTED)

    def save(self):
        self.c.showPage(); self.c.save()


# ======================================================================
def courthouse(path):
    d = Doc(path, "The Courthouse Wedding Kit", "DWB-COURTHOUSE-001")
    d.cover("The Courthouse Wedding Kit", "License to lunch: every step of a courthouse wedding, on paper.",
            ["License and paperwork checklist, step by step", "Questions to call the clerk", "Witness and ID list",
             "Courthouse-day timeline and what to bring", "Small reception plan and guest list", "Budget page",
             "After the wedding: copies and name change"])
    d.license_page([
        "Work through the pages in order. The first three pages get the license and the appointment settled; the rest plan the day and what comes after.",
        "Marriage license rules are set locally. Fees, waiting periods, how long a license stays valid, witness rules and whether you need an appointment all differ by county and change over time. This kit never states them as fact: it gives you the questions, and your county clerk gives you the answers. Write those answers in this kit so both of you can see them.",
        "Keep one copy of this kit, and write the date beside every answer you get from an office, so you know how current it is."])
    d.new_page("License and paperwork, step by step", "Step-by-step checklist")
    d.note("Tick each step and write the date it was done. Your clerk's office may order these differently; follow what they tell you.")
    d.checklist([
        "Choose where you will marry and find the office that issues the license there (usually the county clerk or recorder).",
        "Call or check the clerk's official website and answer the questions on the next page.",
        "Gather the identification and documents the clerk asks for, for both of you.",
        "If either of you was married before, find the divorce decree or death certificate the clerk may ask to see.",
        "Apply for the marriage license, together if the office requires both of you.",
        "Note any waiting period before the license can be used, and the date it expires.",
        "Book the ceremony: a courthouse appointment, a judge or officiant, or your own officiant if allowed.",
        "Confirm your witnesses and tell them what ID to bring.",
        "Hold the ceremony and sign the license with the officiant and witnesses.",
        "Confirm who returns the signed license to the office, and by when.",
        "Order certified copies of the marriage certificate.",
    ], date_col=True)
    d.new_page("Questions to call the clerk", "Write the answers down")
    d.note("Call the office that issues the license. Ask each question, write the answer, and the date you were told.")
    for q in ["Do we apply in person, online, or both? Do we both need to be there?",
              "Which ID and documents does each of us need to bring?",
              "What is the fee, and which payment methods do you accept?",
              "Is there a waiting period after the license is issued? How long is it valid?",
              "Do we need an appointment for the ceremony? How far ahead should we book?",
              "Who can officiate? Can we bring our own officiant?",
              "Do we need witnesses? How many, how old, and what ID do they bring?",
              "How many guests may come into the ceremony room? Are photos allowed?",
              "How do we order certified copies, and what does each cost?"]:
        d.prompt(q, 1)
    d.para("Date of call: ______________   Spoke to: ______________________", 10, MUTED)
    d.new_page("Witnesses and ID", "Who signs, and what they bring")
    d.note("Only list as many witnesses as your clerk requires. Confirm each person has the ID the office asked for.")
    d.table(["Name", "Role", "ID they bring", "Phone", "Confirmed"], 5, [150, 80, 120, 110, 52])
    d.heading("Our own documents", 15, 4)
    d.table(["Document", "Partner 1", "Partner 2", "Where it is"], 7, [170, 80, 80, 182],
            prefill=[["Photo ID", "", "", ""], ["Birth certificate (if asked)", "", "", ""], ["Social Security number (if asked)", "", "", ""],
                     ["Prior divorce or death certificate", "", "", ""], ["Marriage license", "", "", ""]])
    d.new_page("The courthouse day", "Timeline")
    d.note("Build the day backwards from your appointment time. Courthouses often have security lines, so leave a buffer.")
    d.table(["Time", "What happens", "Who", "Done"], 13, [70, 270, 120, 52],
            prefill=[["", "Leave home", "", ""], ["", "Park / arrive, allow for security", "", ""], ["", "Check in at the clerk's office", "", ""],
                     ["", "Ceremony", "", ""], ["", "Sign the license with officiant and witnesses", "", ""], ["", "Photos outside", "", ""],
                     ["", "Lunch or reception", "", ""]])
    d.new_page("What to bring", "Packing checklist")
    d.checklist(["Both photo IDs, and any documents the clerk asked for", "The marriage license (if issued before the day)",
                 "Payment for any fees due on the day", "Rings", "Your vows, on a card", "Witnesses (and their ID)",
                 "Officiant's details, if bringing your own", "Phone charged, and someone to take photos",
                 "Flowers or a small bouquet, if you want one", "Tissues, mints, a pen that works",
                 "Directions, parking money, and the office's phone number", "Reservation details for afterwards"])
    d.new_page("A small reception", "Plan the celebration")
    d.note("A meal, a picnic or a party at home. Compare two or three options before you book.")
    d.table(["Option", "Where", "Seats", "Cost estimate", "Book by"], 3, [100, 150, 60, 110, 92])
    d.heading("Guest list", 15, 4)
    d.table(["Name", "Invited how", "RSVP", "Meal / dietary note"], 12, [170, 100, 60, 182])
    d.new_page("Reception details", "Booking and running order")
    for q in ["Venue or restaurant, address and contact:", "Reservation name, time and deposit:",
              "Menu or catering plan:", "Cake or dessert:", "Toasts and who gives them:"]:
        d.prompt(q, 1)
    d.table(["Time", "What happens", "Who"], 6, [70, 320, 122])
    d.new_page("Budget", "Estimated, actual, paid")
    d.note("Fill in the amounts your clerk and vendors quote you. Leave a line blank rather than guess.")
    d.table(["Item", "Estimate", "Actual", "Paid"], 14, [210, 100, 100, 102],
            prefill=[[x, "", "", ""] for x in ["Marriage license", "Ceremony or officiant fee", "Certified copies", "Outfits",
                                               "Rings", "Flowers", "Photographer", "Reception / meal", "Cake", "Travel and parking",
                                               "Announcements", "Other", "", "TOTAL"]])
    d.new_page("After the wedding", "Copies and name change")
    d.note("Each agency sets its own rules for updating a name. Check its official website for current steps before you go.")
    d.checklist(["Signed license returned to the office (by whom, by when)", "Certified copies ordered and received",
                 "Social Security record updated (if changing a name)", "Driver's license or state ID updated",
                 "Passport updated", "Bank accounts and cards", "Employer and payroll", "Insurance and benefits",
                 "Voter registration", "Utilities, leases and subscriptions"], date_col=True)
    d.new_page("Announcements and thank-yous", "Tracker")
    d.table(["Name", "Told how", "Gift", "Thank-you sent"], 16, [170, 110, 130, 102])
    d.save()
    return d.page


def vows(path):
    d = Doc(path, "The Wedding Vows Workbook", "DWB-VOWS-001")
    d.cover("The Wedding Vows Workbook", "From a blank page to vows you can say out loud.",
            ["Decide the basics together", "Memory and promise prompts", "A five-part structure",
             "Three fill-in templates", "Length and timing guide", "Read-aloud practice page", "Final vows cards"])
    d.license_page([
        "Start with the basics page together, then write on your own. Use the prompts to collect material, the structure to put it in order, and a template if you want a head start.",
        "Write a messy first draft, put it away for a day, then cut. Most vows get better by getting shorter.",
        "If your officiant or venue has guidance on vow length or content, follow it."])
    d.new_page("Decide the basics together", "Before either of you writes")
    for q in ["Roughly how long will each set of vows be? (for example, one minute each)",
              "What tone: funny, serious, or both?",
              "Will we share them before the day, or keep them a surprise?",
              "Same format (both personal, or both traditional), or different?",
              "Who will hold the cards on the day, and who reads first?",
              "Anything off limits (old relationships, private jokes, family topics)?"]:
        d.prompt(q, 1)
    d.new_page("Prompts: remember", "Collect material first")
    d.note("Answer quickly, in a few words. You will not use all of it.")
    for q in ["When did you first know this was different?", "A small everyday moment you love:",
              "Something they do that makes you laugh:", "A hard time you got through together:",
              "What they have taught you:", "How your life is different with them in it:"]:
        d.prompt(q, 2)
    d.new_page("Prompts: promise", "What you are saying yes to")
    for q in ["A promise about how you will treat them on hard days:", "A promise about something fun or silly:",
              "A promise about the life you are building:", "A promise about growing old together:",
              "One line you want them to remember years from now:"]:
        d.prompt(q, 2)
    d.new_page("A five-part structure", "Put it in order")
    for t, b in [("1. Open", "Say their name and one sentence that sets the tone."),
                 ("2. A story", "One short moment from your prompts that shows who they are, or who you are together."),
                 ("3. What you love", "Two or three specific things. Specific beats general."),
                 ("4. Your promises", "Three to five promises, from serious to light, or the other way round."),
                 ("5. Close", "A last line that ties back to the opening and hands the moment over.")]:
        d.para(t, 13, BLUE, "Helvetica-Bold", 2)
        d.para(b, 11, MID, "Helvetica", 2)
        d.lines(2, 20)
    d.new_page("Template 1: classic", "Fill in the blanks")
    d.para("_________, from the day ________________________________, I knew ________________________________.", 13, gap=18, lh=2.3)
    d.para("I love the way you ______________________________ and how you ______________________________.", 13, gap=18, lh=2.3)
    d.para("Today I promise to ______________________________, to ______________________________, and to ______________________________.", 13, gap=18, lh=2.3)
    d.para("I promise to ______________________________ even when ______________________________.", 13, gap=18, lh=2.3)
    d.para("I choose you, today and every day after. ______________________________.", 13, gap=18, lh=2.3)
    d.new_page("Template 2: story-led", "Start with one moment")
    d.para("_________, I keep coming back to one moment: ____________________________________________.", 13, gap=18, lh=2.3)
    d.para("That was when I saw that you ______________________________.", 13, gap=18, lh=2.3)
    d.para("Since then you have taught me ______________________________, and made ______________________________ feel like home.", 13, gap=18, lh=2.3)
    d.para("So here is what I promise: ______________________________. ______________________________. And ______________________________.", 13, gap=18, lh=2.3)
    d.para("Whatever comes next, ______________________________.", 13, gap=18, lh=2.3)
    d.new_page("Template 3: short and sweet", "About thirty seconds")
    d.para("_________, you are ______________________________.", 13, gap=18, lh=2.3)
    d.para("I promise to ______________________________ and to ______________________________.", 13, gap=18, lh=2.3)
    d.para("I will always ______________________________. I love you.", 13, gap=18, lh=2.3)
    d.note("Short vows land best when every word is specific. Swap any general word for a real detail.")
    d.new_page("Length and timing", "How long is long enough")
    d.para("Most people speak about 120 to 150 words a minute when they read aloud slowly and clearly, as you will at a ceremony. Use the table as a rough guide, then time yourself on the practice page.", 11)
    d.table(["Spoken length", "About how many words", "Feels like"], 4, [140, 170, 202], row_h=28,
            prefill=[["30 seconds", "60 to 75", "A short, punchy promise"], ["1 minute", "120 to 150", "Most personal vows"],
                     ["2 minutes", "240 to 300", "A story and promises"], ["3 minutes", "360 to 450", "Long: check with your partner"]])
    d.para("My word count: ________   Partner's target: ________", 11, gap=12)
    d.note("Agree on a target together so one set of vows is not three times as long as the other.")
    d.new_page("Read-aloud practice", "Say it, time it, cut it")
    d.note("Read your vows out loud at least three times before the day. Mark where you stumble and cut or simplify those lines.")
    d.table(["Date", "Time taken", "Where I stumbled", "What I cut or changed"], 8, [70, 80, 180, 182], row_h=34)
    d.checklist(["Final version read aloud to a mirror or a friend", "Card written in large, clear writing", "Card given to the person holding it on the day"])
    d.new_page("Final vows cards", "Cut out and keep")
    c = d.c
    for i in range(2):
        top = H - 1.6 * inch - i * 4.35 * inch
        c.setStrokeColor(MID); c.setDash(4, 3); c.rect(M, top - 3.9 * inch, W - 2 * M, 3.9 * inch, stroke=1, fill=0); c.setDash()
        c.setFillColor(BLUE); c.setFont("Courier", 9); c.drawString(M + 14, top - 22, "MY VOWS")
        c.setStrokeColor(LINE)
        for k in range(9):
            yy = top - 48 - k * 26
            c.line(M + 14, yy, W - M - 14, yy)
    d.save()
    return d.page


def moh(path):
    d = Doc(path, "The Maid of Honor Kit", "DWB-MOH-001")
    d.cover("The Maid of Honor Kit", "Everything you are asked to carry, organized.",
            ["Duties timeline, engagement to wedding day", "Questions to ask the couple", "Shower planner and gift tracker",
             "Bachelorette planner", "Budget split sheet", "Speech builder and practice log", "Day-of emergency kit and run sheet"])
    d.license_page([
        "Every couple wants something different from their maid of honor. Start with the questions page and fill it in with the couple, then use the rest of the kit for the jobs they actually hand you.",
        "Money is the part that causes the most friction. Agree budgets for the shower and bachelorette before anything is booked, and use the split sheet so everyone sees the same numbers."])
    d.new_page("Duties timeline", "From engagement to the wedding day")
    for phase, items in [("Soon after the engagement", ["Ask the couple what help they want (next page)", "Swap contact details with the wedding party"]),
                         ("Six or more months out", ["Help with dress shopping if asked", "Agree shower and bachelorette budgets and dates"]),
                         ("Three to six months out", ["Plan or co-host the shower", "Book the bachelorette", "Start your speech notes"]),
                         ("One to two months out", ["Confirm your outfit, fittings and hair and makeup times", "Collect bachelorette payments", "Draft the speech"]),
                         ("Wedding week", ["Pack the emergency kit", "Confirm the morning schedule", "Practice the speech out loud"]),
                         ("Wedding day", ["Keep the morning on time", "Hold the rings or vows if asked", "Give the toast", "Help with the dress and the last dance"])]:
        d.para(phase, 12, BLUE, "Helvetica-Bold", 3)
        d.checklist(items, 10.5)
    d.new_page("Questions to ask the couple", "So you help with the right things")
    for q in ["Which jobs would you most like help with?", "Who is hosting the shower, and what budget feels right?",
              "What kind of bachelorette (if any), and what should it cost each person?",
              "Anything you do not want: themes, games, people, surprises?",
              "Do you want a toast from me? How long?", "Who should I call on the day if something goes wrong?"]:
        d.prompt(q, 2)
    d.new_page("Shower planner", "The basics")
    for q in ["Date, time and place:", "Hosts and who pays for what:", "Theme or style (if any):", "Food and drink:", "Activities or games:"]:
        d.prompt(q, 1)
    d.table(["Task", "Who", "Due", "Done"], 6, [250, 120, 90, 52],
            prefill=[["Send invitations", "", "", ""], ["Order food or book venue", "", "", ""], ["Decorations", "", "", ""], ["Favors or activities", "", "", ""]])
    d.new_page("Shower guests and gifts", "Tracker")
    d.table(["Guest", "RSVP", "Gift", "Thank-you sent"], 18, [180, 70, 160, 102])
    d.new_page("Bachelorette planner", "Options, dates, bookings")
    d.table(["Option", "Where", "Cost per person", "Votes"], 3, [150, 160, 110, 92])
    d.heading("Dates that work", 15, 4)
    d.table(["Date", "Who can come", "Who cannot"], 4, [120, 200, 192])
    d.heading("Bookings", 15, 4)
    d.table(["Booking", "Confirmation", "Cost", "Paid by", "Due"], 5, [130, 120, 80, 100, 82])
    d.new_page("Budget split sheet", "Everyone sees the same numbers")
    d.note("Per person = total divided by the number of people sharing it. Decide up front whether the person being celebrated pays.")
    d.table(["Item", "Total", "People", "Per person", "Paid by", "Settled"], 14, [140, 70, 60, 80, 110, 52])
    d.new_page("Speech builder", "A toast in five parts")
    d.para("Aim for about two to three minutes, roughly 250 to 400 words read slowly. Short is kind to everyone.", 11)
    for t, b in [("1. Hello", "Who you are and how you know them, in one sentence."),
                 ("2. A story", "One short, kind story that shows who they are. Nothing a grandparent should not hear."),
                 ("3. Them together", "What you have seen change since they met."),
                 ("4. A wish", "What you hope for them."),
                 ("5. The toast", "Ask everyone to raise a glass, and say their names.")]:
        d.para(t, 12.5, BLUE, "Helvetica-Bold", 2)
        d.para(b, 10.5, MID, "Helvetica", 2)
        d.lines(1, 20)
    d.new_page("Speech prompts", "Collect material")
    for q in ["The first time you met them:", "A story that makes you laugh every time:", "What their partner brings out in them:",
              "A word that sums them up, and why:", "Your wish for them:"]:
        d.prompt(q, 2)
    d.new_page("Speech draft and practice", "Say it out loud")
    d.note("Write the draft here, then read it aloud with a timer. Cut anything that needs explaining to half the room.")
    d.lines(10, 22)
    d.table(["Date", "Time taken", "What I cut"], 4, [90, 100, 322], row_h=28)
    d.new_page("Day-of emergency kit", "Pack it the night before")
    d.checklist(["Safety pins and a small sewing kit", "Fashion tape", "Stain remover pen", "Tissues and blotting papers",
                 "Pain relievers the couple is happy to have on hand", "Bandages and blister pads", "Phone charger and power bank",
                 "Snacks and water", "Hair ties, pins and a small brush", "Breath mints", "Copies of the timeline and key phone numbers",
                 "The rings or vows, if you are holding them", "Your speech, printed"], 10.5)
    d.new_page("Wedding day run sheet", "Your part of the day")
    d.table(["Time", "What", "Where", "Done"], 14, [70, 270, 120, 52],
            prefill=[["", "Hair and makeup", "", ""], ["", "Help with the dress", "", ""], ["", "Photos", "", ""], ["", "Ceremony", "", ""],
                     ["", "Toast", "", ""]])
    d.save()
    return d.page


if __name__ == "__main__":
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    for fn, name in [(courthouse, "DWB-COURTHOUSE-001_v1.0.0.pdf"), (vows, "DWB-VOWS-001_v1.0.0.pdf"), (moh, "DWB-MOH-001_v1.0.0.pdf")]:
        print(name, fn(out / name), "pages")
