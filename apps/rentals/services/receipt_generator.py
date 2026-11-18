import io
from decimal import Decimal
from django.utils import timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_receipt_pdf_bytes(receipt):
    """
    Generates a professional PDF receipt in memory using ReportLab.
    Meets all MVP 2 receipt criteria:
    - Receipt reference
    - Tenant identifier
    - Property or rental unit
    - Rental period
    - Payment amount and asset
    - Date of confirmed payment
    - Stellar transaction hash
    - Outstanding balance after payment
    - Payment verification status
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#0F172A'),
        fontName='Helvetica-Bold'
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748B'),
        fontName='Helvetica'
    )
    section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading3'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        fontName='Helvetica-Bold'
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        fontName='Helvetica'
    )
    badge_style = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#047857'),
        fontName='Helvetica-Bold'
    )

    elements = []

    # Header
    elements.append(Paragraph("PayarMove", title_style))
    elements.append(Paragraph("Stellar-Powered Rental Payment Platform | Payment Receipt", subtitle_style))
    elements.append(Spacer(1, 15))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284C7'), spaceAfter=15))

    # Meta Table: Receipt # and Status
    pay_date = receipt.payment_date.strftime("%B %d, %Y at %H:%M UTC") if receipt.payment_date else "N/A"
    header_data = [
        [
            Paragraph(f"<b>Receipt Reference:</b> {receipt.receipt_number}", body_style),
            Paragraph(f"<b>Date Confirmed:</b> {pay_date}", body_style)
        ],
        [
            Paragraph(f"<b>Verification Status:</b> <font color='#059669'>VERIFIED ON STELLAR TESTNET</font>", badge_style),
            Paragraph(f"<b>Payment Reference:</b> {receipt.payment.payment_reference if receipt.payment else 'N/A'}", body_style)
        ]
    ]
    t_header = Table(header_data, colWidths=[3.5 * inch, 3.5 * inch])
    t_header.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t_header)
    elements.append(Spacer(1, 20))

    # Tenancy & Rental Period Details
    elements.append(Paragraph("Rental Obligation Details", section_title))
    elements.append(Spacer(1, 6))

    unit_display = f" (Unit {receipt.unit_number})" if receipt.unit_number else ""
    details_data = [
        [Paragraph("<b>Tenant Account:</b>", body_style), Paragraph(receipt.tenant.email, body_style)],
        [Paragraph("<b>Property:</b>", body_style), Paragraph(f"{receipt.property_name}{unit_display}", body_style)],
        [Paragraph("<b>Rental Period:</b>", body_style), Paragraph(receipt.rental_period, body_style)],
        [Paragraph("<b>Obligation Reference:</b>", body_style), Paragraph(receipt.obligation.obligation_reference if receipt.obligation else "N/A", body_style)],
        [Paragraph("<b>Payment Due Date:</b>", body_style), Paragraph(str(receipt.obligation.due_date) if receipt.obligation else "N/A", body_style)],
    ]
    t_details = Table(details_data, colWidths=[2.2 * inch, 4.8 * inch])
    t_details.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t_details)
    elements.append(Spacer(1, 20))

    # Payment Breakdown Table
    elements.append(Paragraph("Financial Summary & Balance", section_title))
    elements.append(Spacer(1, 6))

    amount_str = f"{receipt.amount_paid:.2f} {receipt.asset_code}"
    balance_str = f"{receipt.outstanding_balance_after:.2f} {receipt.asset_code}"
    due_str = f"{receipt.obligation.amount_due_usdc:.2f} {receipt.asset_code}" if receipt.obligation else "N/A"

    finance_data = [
        [Paragraph("<b>Description</b>", body_style), Paragraph("<b>Amount</b>", body_style)],
        [Paragraph("Total Rent Obligation Due", body_style), Paragraph(due_str, body_style)],
        [Paragraph("<b>Amount Paid in this Transaction</b>", body_style), Paragraph(f"<b>{amount_str}</b>", body_style)],
        [Paragraph("<b>Remaining Outstanding Rent Balance</b>", body_style), Paragraph(f"<b>{balance_str}</b>", body_style)],
    ]
    t_finance = Table(finance_data, colWidths=[4.5 * inch, 2.5 * inch])
    t_finance.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#ECFDF5')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#FEF2F2') if receipt.outstanding_balance_after > Decimal('0') else colors.HexColor('#F0FDF4')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    elements.append(t_finance)
    elements.append(Spacer(1, 20))

    # Stellar Blockchain Verification Details
    elements.append(Paragraph("Stellar Testnet Cryptographic Verification", section_title))
    elements.append(Spacer(1, 6))

    blockchain_data = [
        [Paragraph("<b>Network:</b>", body_style), Paragraph("Stellar Testnet (SEP-0010 & Soroban-ready)", body_style)],
        [Paragraph("<b>Transaction Hash:</b>", body_style), Paragraph(f"<font name='Courier'>{receipt.stellar_tx_hash}</font>", body_style)],
        [Paragraph("<b>Payment Operation ID:</b>", body_style), Paragraph(f"<font name='Courier'>{receipt.stellar_op_id or 'N/A'}</font>", body_style)],
        [Paragraph("<b>Receiving Wallet:</b>", body_style), Paragraph(f"<font name='Courier'>{receipt.obligation.receiving_wallet if receipt.obligation else 'N/A'}</font>", body_style)],
        [Paragraph("<b>Block Explorer:</b>", body_style), Paragraph(receipt.stellar_explorer_url, body_style)],
    ]
    t_blockchain = Table(blockchain_data, colWidths=[2.2 * inch, 4.8 * inch])
    t_blockchain.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#EDF2F7')),
    ]))
    elements.append(t_blockchain)
    elements.append(Spacer(1, 25))

    # Footer Notice
    footer_text = (
        "This official receipt confirms payment settlement on the Stellar Testnet ledger. "
        "PayarMove applies cryptographic reconciliation to prevent duplicate charges and preserve audit trails. "
        "For support, contact support@payarmove.com."
    )
    elements.append(Paragraph(footer_text, subtitle_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

