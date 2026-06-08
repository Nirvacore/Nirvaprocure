# นโยบายการจัดซื้อจัดจ้าง (Procurement Policy) — ฉบับเทมเพลต

> เทมเพลตสำหรับบริษัทที่ใช้ NIRVAPROCURE. **ไม่ใช่คำปรึกษาทางกฎหมาย** —
> ผ่านการตรวจกับ DPO/ทนาย/ผู้สอบบัญชีของบริษัทคุณก่อนใช้จริง.
>
> ปรัชญา: เครื่องมือไม่แก้ปัญหาคน — แต่ทำให้การโกงยากขึ้นและการทำดีง่ายขึ้น.
> ทุกข้อนโยบายด้านล่างมีการ enforce อัตโนมัติใน NIRVAPROCURE อ้างอิงในคอลัมน์ "ระบบบังคับใช้".

| ลำดับ | สาระสำคัญ | ระบบบังคับใช้ |
|---|---|---|
| 1 | แยกหน้าที่ (Segregation of Duties) | `ApprovalsService.decide()` 403 ถ้า approver = requester; `PrService.submit()` ปฏิเสธ workflow ที่ไม่มี approver คนอื่น |
| 2 | เลือก vendor ใหม่ต้องผ่าน compliance | `AnomalyScanJob` flag เป็น `kind='new_supplier'` รายวัน + LINE digest ถึง admin |
| 3 | เปิดเผยผลประโยชน์ทับซ้อน (CoI) | `/anomaly/disclosures` self-declare + `prHasCoi()` ที่ submit-time fire `kind='coi_match'` severity critical |
| 4 | ราคาผิดปกติต้องตรวจ | `AnomalyScanJob` flag `price_spike` เมื่อ unit_price > 1.5× median 90 วัน |
| 5 | ทุกการตัดสินใจมีร่องรอย | `audit_log` append-only + retention 90 วัน + S3 archive ก่อน purge |
| 6 | คุ้มครองข้อมูลส่วนบุคคล (PDPA) | `/compliance/export/me` + `/compliance/redact/:user_id` (PDPA Section 30/33) |
| 7 | ช่องทางแจ้งเบาะแสไม่ระบุตัวตน | ระบุอีเมล CFO ใน "ช่องทางแจ้งเหตุ" ด้านล่าง — ไม่ผ่าน NIRVAPROCURE |
| 8 | รายงานต่อผู้บริหาร | `/analytics/summary` + `/analytics/savings/leaderboard` รายเดือน |

---

## ๑. วัตถุประสงค์

นโยบายนี้กำหนดหลักการ ขอบเขต และวิธีปฏิบัติของการจัดซื้อจัดจ้างเพื่อให้:
- ทุกการจัดซื้อโปร่งใส ตรวจสอบได้ และคุ้มค่า
- ผู้เกี่ยวข้องปฏิบัติหน้าที่ด้วยความซื่อสัตย์
- บริษัทปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล 2562 (PDPA) และระเบียบบัญชีที่เกี่ยวข้อง

## ๒. ขอบเขต

ใช้กับการจัดซื้อทุกประเภทของบริษัท รวมถึงสินค้าจาก Shopee, Lazada, Makro, Alibaba, และผู้จำหน่ายตรง.

## ๓. ระดับอำนาจอนุมัติ (Approval Tier)

| ยอดต่อใบ (บาท) | ผู้อนุมัติ |
|---|---|
| ≤ 50,000 | หัวหน้าฝ่ายของผู้ขอ |
| 50,001 – 200,000 | หัวหน้าฝ่าย + ฝ่ายการเงิน |
| > 200,000 | หัวหน้าฝ่าย + ฝ่ายการเงิน + CFO |
| > 1,000,000 | + ผู้บริหารสูงสุด (CEO/MD) |

**ระบบบังคับใช้:** กำหนดเป็น `approval_workflows` ใน NIRVAPROCURE; `match_rules.min_amount_minor` คัดกรองตามยอด. ใบที่ยอดเกินทุก rule = ตกที่ rule ใหญ่สุด.

**ห้ามทำ:**
- **ห้ามแบ่งใบขอเพื่อหลบ threshold** (split PO) — anomaly detector จะจับ pattern ของผู้ขอที่ส่งหลายใบติดให้ supplier เดียวกันภายใน 24 ชม.
- **ห้ามอนุมัติย้อนหลัง** — `submitted_at` และ `decided_at` ใน DB เป็นหลักฐาน
- **ห้ามใช้บัตรเครดิตส่วนตัวซื้อก่อนแล้วมาเบิกคืน** — ทุกใบต้องผ่าน NIRVAPROCURE ก่อนซื้อ

## ๔. แยกหน้าที่ (Segregation of Duties)

- ผู้ขอ (Requester) ≠ ผู้อนุมัติ (Approver)
- ผู้อนุมัติ ≠ ผู้รับสินค้า (Receiver)
- ผู้รับสินค้า ≠ ผู้จ่ายเงิน

ห้ามคนเดียวมี role > 1 ในห่วงโซ่จัดซื้อใบเดียวกัน. ระบบ enforce ใน `ApprovalsService.decide()`.

## ๕. การคัดเลือกผู้จำหน่าย

- **Supplier ใหม่** ต้องผ่านการตรวจของ compliance officer ก่อนการสั่งซื้อครั้งแรก:
  - ตรวจสอบทะเบียนพาณิชย์ / เลขประจำตัวผู้เสียภาษี
  - บัญชีธนาคารต้องตรงกับชื่อนิติบุคคล (ห้ามจ่ายเข้าบัญชีบุคคล)
  - **First-time supplier** = `AnomalyScanJob` flag → admin รับแจ้งทาง LINE
- **Supplier ที่ใช้อยู่** ต้อง re-validate ทุก 12 เดือน (เอกสาร DBD update)

## ๖. การเปิดเผยผลประโยชน์ทับซ้อน (Conflict of Interest)

ผู้ขอ/ผู้อนุมัติทุกคนต้องเปิดเผยความสัมพันธ์กับ supplier ภายใน 7 วันนับจาก:
- พบความสัมพันธ์ใหม่ (เช่น ญาติเปิดบริษัท)
- เริ่มงานในบริษัท (เปิดเผยย้อนหลังให้หมด)

ความสัมพันธ์ที่ต้องเปิดเผย:
- **family** — สมาชิกครอบครัวภายใน 3 องศา (พ่อแม่ พี่น้อง คู่สมรส บุตร)
- **former_employer** — เคยทำงานให้ supplier ภายใน 3 ปี
- **investor** — ถือหุ้น/มีผลประโยชน์ทางการเงินใน supplier
- **partner** — หุ้นส่วนทางธุรกิจอื่น

ระบบ: `POST /v1/anomaly/disclosures`. ใบขอใดที่มี supplier ตรงกับ disclosure → `kind='coi_match', severity='critical'` แจ้ง compliance ทันที ใบยังผ่านได้แต่ต้อง re-review.

## ๗. การเก็บเอกสารและร่องรอย

- ใบขอ (PR) + ใบสั่งซื้อ (PO) + ใบรับสินค้า (GR) + ใบกำกับภาษี (Invoice) เก็บ **อย่างน้อย 7 ปี** ตามประมวลรัษฎากร
- Audit log เก็บใน DB 90 วัน แล้วย้ายไป S3 (Glacier transition) เก็บถาวร
- **ห้ามลบ** ใบที่ส่งเข้าระบบแล้ว — แก้ไขด้วยการสร้างใบยกเลิก (cancellation PR)

## ๘. การคุ้มครองข้อมูลส่วนบุคคล (PDPA)

- ข้อมูลส่วนบุคคลที่เก็บ: อีเมล ชื่อนามสกุล LINE user id (เฉพาะที่ผูกบัญชี)
- พนักงานมีสิทธิขอสำเนา: `GET /v1/compliance/export/me`
- พนักงานขอลบ → `POST /v1/compliance/redact/:user_id` (pseudonymization; ไม่ลบ audit trail ที่ต้องเก็บตามกฎหมายอื่น)
- รายละเอียดเต็มใน `database/COMPLIANCE.md`

## ๙. รหัสผ่านและการเข้าระบบ

- รหัสผ่านขั้นต่ำ 8 ตัว, ระบบเก็บเป็น bcrypt hash (10 รอบ)
- บัญชี **admin/CFO** ต้องเปิด 2FA TOTP — บังคับใน production
- Session: access token 15 นาที, refresh token 14 วัน, ทั้งคู่เป็น httpOnly cookies
- ออกจากระบบทุกวัน หรือเมื่อใช้เครื่องสาธารณะเสร็จ

## ๑๐. ช่องทางแจ้งเหตุ (Whistleblower)

หากพบการทุจริต/ผลประโยชน์ทับซ้อน/ราคาผิดปกติที่ไม่กล้าแจ้งผ่านระบบ:

📧 **whistleblower@yourdomain.com** — ตรงถึง CFO เท่านั้น  
📞 **02-xxx-xxxx** — สายตรงคณะกรรมการตรวจสอบ  
📮 ตู้รับเรื่องในห้องประชุมใหญ่ ชั้น...

**บริษัทรับประกันการรักษาตัวตนของผู้แจ้ง** และไม่ลงโทษผู้แจ้งโดยสุจริต — แม้ผลการสอบสวนสุดท้ายไม่พบความผิด.

## ๑๑. การตรวจสอบและการรายงาน

- **รายเดือน** — ผู้จัดการแต่ละแผนกตรวจรายงาน `/analytics/summary` (ใบขอ + spend + SLA)
- **รายไตรมาส** — CFO ตรวจ anomaly_alerts ที่ยังไม่ acknowledged
- **รายปี** — ผู้สอบบัญชีอิสระเข้าตรวจ access ผ่าน `/compliance/export/:user_id` ของบัญชี audit

## ๑๒. บทลงโทษ

การฝ่าฝืนนโยบายโดยเจตนา (โกง รับ kickback ไม่เปิดเผย CoI) เป็นเหตุให้:
- ตักเตือนเป็นลายลักษณ์อักษร (ครั้งแรก, ฝ่าฝืนไม่ร้ายแรง)
- ปลดออก (ฝ่าฝืนซ้ำ หรือร้ายแรง)
- ดำเนินคดีตามประมวลกฎหมายอาญา (กรณียักยอกหรือฉ้อโกง)

ระบบเก็บหลักฐานครบ — ทุกการลงชื่อเข้าระบบ ทุกการอนุมัติ ทุกการเปลี่ยน PR ติดตามได้ใน `audit_log`.

---

## ภาคผนวก ก — การ map กับฟีเจอร์ NIRVAPROCURE

| นโยบายข้อ | ไฟล์ / โมดูล | ตำแหน่งการ enforce |
|---|---|---|
| ๓ Approval tier | `approval_workflows` (DB) + `WorkflowsService` | UI: `/settings → กฎการอนุมัติ` |
| ๔ Segregation | `ApprovalsService.decide()` + `PrService.submit()` | ห้าม approver=requester runtime + ห้าม workflow ไม่มี approver อื่น |
| ๕ New supplier gate | `AnomalyScanJob.scan()` | Cron daily 9 AM Bangkok |
| ๖ CoI | `AnomalyService.prHasCoi()` + `user_supplier_disclosures` | Submit-time alert |
| ๗ Retention | `ComplianceService.purgeAuditLog()` + `AuditArchiveService` | S3 ก่อน delete |
| ๘ PDPA | `ComplianceModule` | `/v1/compliance/export/*` + `/redact/:id` |
| ๙ Auth hardening | `AuthController` + `TotpService` | 2FA on by user; bcrypt + httpOnly |
| ๑๑ Reporting | `AnalyticsModule` | `/v1/analytics/summary` + `/savings/leaderboard` |

## ภาคผนวก ข — แม่แบบประกาศพนักงาน

> **เพื่อทราบ:** ตั้งแต่วันที่ \_\_\_\_\_\_ การจัดซื้อทุกประเภทของบริษัทจะดำเนินการผ่าน NIRVAPROCURE.
>
> โปรดอ่านนโยบาย POLICY.md ก่อนใช้งาน และเปิดเผยความสัมพันธ์กับ supplier ที่บริษัทใช้
> ภายใน 7 วัน. หากพบเหตุไม่ชอบมาพากล แจ้งได้ที่ whistleblower@yourdomain.com.
>
> — ฝ่ายการเงินและบัญชี
