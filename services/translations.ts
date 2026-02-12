
import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'th' | 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

// Static dictionary is KEPT for "UI Shell" elements (Buttons, Menus, Headers) 
// to ensure zero-latency navigation. AI handles the dynamic content.
const translations: Record<Language, Record<string, string>> = {
  th: {
    // --- Layout ---
    'app.title': 'CDG Travel Portal',
    'role': 'บทบาท',
    'sign_out': 'ลงชื่อออก',
    'dashboard': 'แดชบอร์ด',
    'new_request': 'สร้างคำขอใหม่',
    'my_requests': 'รายการของฉัน',
    'settings': 'ตั้งค่าระบบ',

    // --- Chat ---
    'chat.title': 'CDG Travel Buddy',
    'chat.welcome': 'สวัสดีครับ! CDG Travel Buddy ยินดีให้บริการ 🙏\nผมสามารถช่วยสร้างใบขออนุมัติเดินทาง หรือตรวจสอบสถานะได้ครับ',
    'chat.placeholder': 'พิมพ์ข้อความ... (รองรับไทย/อังกฤษ/จีน)',
    'chat.online': 'ออนไลน์',
    'chat.quick.stats': 'ดูสถิติ 📊',
    'chat.quick.policy': 'เช็ค Policy 🛡️',
    'chat.quick.create': 'สร้าง Request ✈️',
    'chat.error': 'ขออภัยครับ ระบบขัดข้อง',
    'chat.slip.title': 'ใบคำขออนุมัติเดินทาง',
    'chat.slip.id': 'เลขที่เอกสาร',
    'chat.slip.dest': 'ปลายทาง',
    'chat.slip.date': 'วันที่เดินทาง',
    'chat.slip.cost': 'งบประมาณ',
    'chat.slip.status': 'สถานะปัจจุบัน',
    'chat.draft.review': 'ตรวจสอบแบบร่าง',
    'chat.draft.submit': 'ยืนยันและส่งคำขอ',
    'chat.draft.edit': 'แก้ไข',
    
    // --- Dashboard ---
    'dash.title': 'Enterprise Travel Portal',
    'dash.costCenter': 'Cost Center',
    'dash.btn.create': 'สร้างคำขอใหม่',
    'dash.stat.newReq': 'คำขอใหม่',
    'dash.stat.pendingQuote': 'รอใบเสนอราคา',
    'dash.stat.processed': 'ดำเนินการแล้ว',
    'dash.stat.policyFlag': 'ผิดเงื่อนไข',
    'dash.stat.activeTrips': 'ทริปที่กำลังดำเนินการ',
    'dash.stat.approvalsWaiting': 'รออนุมัติ',
    'dash.stat.totalSpend': 'ยอดใช้จ่าย (ปีนี้)',
    'dash.stat.slaCompliance': 'SLA Compliance',
    'dash.ads.tab.inbox': 'กล่องข้อความ',
    'dash.ads.tab.all': 'คำขอทั้งหมด',
    'dash.ads.export': 'ส่งออก / พิมพ์',
    'dash.ads.caughtUp': 'ไม่มีรายการใหม่! คุณจัดการครบแล้ว',
    'dash.list.recent': 'รายการล่าสุดของฉัน',
    'dash.list.viewAll': 'ดูทั้งหมด',
    'dash.table.id': 'รหัส',
    'dash.table.detail': 'รายละเอียด',
    'dash.table.type': 'ประเภท',
    'dash.table.status': 'สถานะ',
    'dash.table.cost': 'ค่าใช้จ่าย',
    'dash.table.actions': 'จัดการ',

    // --- New Request Form ---
    'form.step.travelers': 'ผู้เดินทาง',
    'form.step.trip': 'ข้อมูลการเดินทาง',
    'form.step.services': 'บริการที่ต้องการ',
    'form.step.review': 'ตรวจสอบ',
    'form.cancel': 'ยกเลิก',
    'form.next': 'ถัดไป',
    'form.back': 'ย้อนกลับ',
    'form.submit': 'ส่งคำขอ',
    'form.update': 'อัปเดตข้อมูล',
    'form.whoTraveling': 'เดินทางสำหรับ?',
    'form.travelType': 'ประเภทการเดินทาง',
    'form.addPerson': 'เพิ่มผู้เดินทาง',
    
    // Traveler Details
    'form.label.title': 'คำนำหน้า',
    'form.label.fullName': 'ชื่อ-นามสกุล',
    'form.label.empId': 'รหัสพนักงาน',
    'form.label.dept': 'แผนก',
    'form.label.company': 'บริษัท / หน่วยงาน',
    'form.label.grade': 'ระดับ / ตำแหน่ง',
    'form.label.position': 'ตำแหน่ง',
    'form.label.mobile': 'เบอร์โทรศัพท์',
    'form.label.email': 'อีเมล',
    'form.label.dob': 'วันเกิด',
    'form.label.passport': 'เลขพาสปอร์ต',
    'form.label.passportExpiry': 'วันหมดอายุ',
    
    'form.label.origin': 'ต้นทาง',
    'form.label.dest': 'ปลายทาง',
    'form.label.start': 'วันที่เริ่ม',
    'form.label.end': 'วันที่สิ้นสุด',
    'form.label.purpose': 'วัตถุประสงค์',
    'form.btn.aiJustification': 'ให้ AI ช่วยเขียนเหตุผล',
    'form.label.project': 'รหัสโครงการ',
    'form.label.costCenter': 'Cost Center',
    'form.label.estCost': 'งบประมาณโดยประมาณ',
    'form.policy.compliant': 'ผ่านเกณฑ์นโยบาย',
    'form.policy.warning': 'แจ้งเตือนนโยบาย',
    'form.approvalWorkflow': 'สายการอนุมัติ',

    // --- Request List ---
    'reqList.title': 'รายการคำขอของฉัน',
    'reqList.subtitle': 'ติดตามสถานะและประวัติการเดินทางทั้งหมด',
    'reqList.searchPlaceholder': 'ค้นหา ปลายทาง, รหัส, หรือชื่อ...',
    'reqList.filter.all': 'ทั้งหมด',
    'reqList.filter.active': 'กำลังดำเนินการ',
    'reqList.filter.completed': 'เสร็จสิ้น',
    'reqList.empty': 'ไม่พบรายการที่ค้นหา',

    // --- Settings (NEW) ---
    'settings.title': 'การตั้งค่านโยบายและระบบ',
    'settings.subtitle': 'จัดการกฎระเบียบการเดินทางและกำหนดค่าระบบ AI',
    'settings.btn.save': 'บันทึกข้อมูล',
    'settings.btn.saved': 'บันทึกเรียบร้อย!',
    'settings.tab.rules': 'กฎระเบียบ',
    'settings.tab.system': 'ระบบและ AI',
    'settings.tab.vendors': 'ผู้ให้บริการ',
    
    'settings.subtab.general': 'ทั่วไปและเบี้ยเลี้ยง',
    'settings.subtab.flight': 'นโยบายตั๋วเครื่องบิน',
    'settings.subtab.hotel': 'ระดับโรงแรม (Tiers)',
    'settings.subtab.doa': 'วงเงินอนุมัติ (DOA)',

    'settings.sect.global': 'การเบิกจ่ายทั่วไป',
    'settings.lbl.mileage': 'ค่าเดินทางส่วนตัว (บาท/กม.)',
    'settings.lbl.advBooking': 'จองล่วงหน้า (วัน - ตปท.)',
    'settings.sect.perDiem': 'อัตราเบี้ยเลี้ยง (Per Diem)',
    
    'settings.sect.flightRules': 'เกณฑ์สิทธิ์การบิน',
    'settings.btn.addRule': '+ เพิ่มกฎ',
    'settings.desc.flight': 'ระบบจะตรวจสอบกฎจากบนลงล่างตามระดับพนักงาน (Job Grade)',
    'settings.lbl.minDuration': 'ระยะเวลาขั้นต่ำ (ชม.)',
    'settings.lbl.cabin': 'ชั้นโดยสารที่อนุญาต',
    'settings.lbl.grades': 'ระดับงาน (คั่นด้วยจุลภาค)',

    'settings.sect.hotelDefault': 'วงเงินโรงแรมมาตรฐาน',
    'settings.lbl.domDefault': 'ในประเทศ',
    'settings.lbl.intlDefault': 'ต่างประเทศ',
    'settings.sect.zones': 'โซนเมืองพิเศษ (Tiers)',
    'settings.btn.addZone': '+ เพิ่มโซน',
    'settings.lbl.zoneName': 'ชื่อโซน',
    'settings.lbl.cities': 'รายชื่อเมือง (คั่นด้วยจุลภาค)',
    'settings.lbl.limit': 'วงเงิน',
    'settings.lbl.currency': 'สกุลเงิน',

    'settings.sect.doa': 'เกณฑ์การอนุมัติ',
    'settings.lbl.deptHead': 'วงเงินระดับผอ.ฝ่าย',
    'settings.desc.deptHead': 'เกินกว่านี้ต้องขออนุมัติ L2',
    'settings.lbl.exec': 'วงเงินระดับผู้บริหาร (C-Level)',
    'settings.desc.exec': 'เกินกว่านี้ต้องขออนุมัติ L3',

    'settings.sect.ai': 'การตั้งค่า AI Provider',
    'settings.lbl.apiKey': 'API Key',
    'settings.lbl.model': 'Model Name',
    'settings.lbl.providerSelect': 'เลือก Provider ที่ต้องการแก้ไข',
    'settings.sect.features': 'การจับคู่ฟีเจอร์ (Feature Mapping)',
    'settings.desc.features': 'กำหนดว่าจะใช้ AI ตัวไหนในการประมวลผลแต่ละส่วนของระบบ',

    // --- Common Terms ---
    'common.domestic': 'ในประเทศ',
    'common.international': 'ต่างประเทศ',
    'common.self': 'ตนเอง',
    'common.employee': 'พนักงาน',
    'common.client': 'ลูกค้า/แขก',
    'status.Draft': 'ร่าง',
    'status.Submitted': 'ส่งแล้ว',
    'status.Quotation Pending': 'รอใบเสนอราคา',
    'status.Waiting Selection': 'รอเลือก Option', // NEW
    'status.Pending Approval': 'รออนุมัติ',
    'status.Approved': 'อนุมัติแล้ว',
    'status.Rejected': 'ไม่อนุมัติ',
    'status.Booked': 'จองแล้ว',
    'status.Completed': 'เสร็จสิ้น'
  },
  en: {
    // --- Layout ---
    'app.title': 'CDG Travel Portal',
    'role': 'Role',
    'sign_out': 'Sign Out',
    'dashboard': 'Dashboard',
    'new_request': 'New Request',
    'my_requests': 'My Requests',
    'settings': 'Settings',

    // --- Chat ---
    'chat.title': 'CDG Travel Buddy',
    'chat.welcome': 'Hello! I am CDG Travel Buddy.\nI can help you create travel requests or check status.',
    'chat.placeholder': 'Type a message... (TH/EN/ZH supported)',
    'chat.online': 'Online',
    'chat.quick.stats': 'My Stats 📊',
    'chat.quick.policy': 'Check Policy 🛡️',
    'chat.quick.create': 'New Request ✈️',
    'chat.error': 'Sorry, something went wrong.',
    'chat.slip.title': 'Travel Request Slip',
    'chat.slip.id': 'Document ID',
    'chat.slip.dest': 'Destination',
    'chat.slip.date': 'Travel Dates',
    'chat.slip.cost': 'Est. Cost',
    'chat.slip.status': 'Current Status',
    'chat.draft.review': 'Review Draft',
    'chat.draft.submit': 'Confirm & Submit',
    'chat.draft.edit': 'Edit',

    // --- Dashboard ---
    'dash.title': 'Enterprise Travel Portal',
    'dash.costCenter': 'Cost Center',
    'dash.btn.create': 'Create Request',
    'dash.stat.newReq': 'New Requests',
    'dash.stat.pendingQuote': 'Pending Quotes',
    'dash.stat.processed': 'Processed',
    'dash.stat.policyFlag': 'Policy Flags',
    'dash.stat.activeTrips': 'Active Trips',
    'dash.stat.approvalsWaiting': 'Approvals Waiting',
    'dash.stat.totalSpend': 'Total Spend (YTD)',
    'dash.stat.slaCompliance': 'SLA Compliance',
    'dash.ads.tab.inbox': 'Inbox',
    'dash.ads.tab.all': 'All Requests',
    'dash.ads.export': 'Export / Print',
    'dash.ads.caughtUp': 'All caught up! No new requests.',
    'dash.list.recent': 'My Recent Requests',
    'dash.list.viewAll': 'View All',
    'dash.table.id': 'ID',
    'dash.table.detail': 'Detail',
    'dash.table.type': 'Type',
    'dash.table.status': 'Status',
    'dash.table.cost': 'Cost',
    'dash.table.actions': 'Actions',

    // --- New Request Form ---
    'form.step.travelers': 'Requester & Travelers',
    'form.step.trip': 'Trip Info',
    'form.step.services': 'Services',
    'form.step.review': 'Review',
    'form.cancel': 'Cancel',
    'form.next': 'Next',
    'form.back': 'Back',
    'form.submit': 'Submit Request',
    'form.update': 'Update',
    'form.whoTraveling': 'Who is traveling?',
    'form.travelType': 'Travel Type',
    'form.addPerson': 'Add Person',
    
    // Traveler Details
    'form.label.title': 'Title',
    'form.label.fullName': 'Full Name',
    'form.label.empId': 'Employee ID',
    'form.label.dept': 'Department',
    'form.label.company': 'Company',
    'form.label.grade': 'Job Grade',
    'form.label.position': 'Position',
    'form.label.mobile': 'Contact Number',
    'form.label.email': 'Email Address',
    'form.label.dob': 'Date of Birth',
    'form.label.passport': 'Passport Number',
    'form.label.passportExpiry': 'Passport Expiry',

    'form.label.origin': 'Origin',
    'form.label.dest': 'Destination',
    'form.label.start': 'Start Date',
    'form.label.end': 'End Date',
    'form.label.purpose': 'Trip Purpose',
    'form.btn.aiJustification': 'AI Generate Justification',
    'form.label.project': 'Project Code',
    'form.label.costCenter': 'Cost Center',
    'form.label.estCost': 'Total Estimated Cost',
    'form.policy.compliant': 'Policy Compliant',
    'form.policy.warning': 'Policy Warnings',
    'form.approvalWorkflow': 'Approval Workflow',

    // --- Request List ---
    'reqList.title': 'My Requests',
    'reqList.subtitle': 'Manage and track all your travel requests.',
    'reqList.searchPlaceholder': 'Search destination, ID, or name...',
    'reqList.filter.all': 'ALL',
    'reqList.filter.active': 'ACTIVE',
    'reqList.filter.completed': 'COMPLETED',
    'reqList.empty': 'No requests found matching your criteria.',

    // --- Settings (NEW) ---
    'settings.title': 'Policy & System Configuration',
    'settings.subtitle': 'Manage global travel rules, approval workflows, and system integrations.',
    'settings.btn.save': 'Save Changes',
    'settings.btn.saved': 'Changes Saved!',
    'settings.tab.rules': 'Travel Rules',
    'settings.tab.system': 'System & AI',
    'settings.tab.vendors': 'Vendors',
    
    'settings.subtab.general': 'General & Per Diem',
    'settings.subtab.flight': 'Flight Policy',
    'settings.subtab.hotel': 'Hotel Tiers',
    'settings.subtab.doa': 'Approval (DOA)',

    'settings.sect.global': 'Global Allowances',
    'settings.lbl.mileage': 'Mileage Rate (THB/KM)',
    'settings.lbl.advBooking': 'Advance Booking (Intl Days)',
    'settings.sect.perDiem': 'Per Diem Rates',
    
    'settings.sect.flightRules': 'Flight Eligibility Rules',
    'settings.btn.addRule': '+ Add Rule',
    'settings.desc.flight': 'Rules are matched from top to bottom. Define job grades (e.g., 10-12 Staff).',
    'settings.lbl.minDuration': 'Min Duration (Hours)',
    'settings.lbl.cabin': 'Allowed Cabin',
    'settings.lbl.grades': 'Job Grades (Comma sep)',

    'settings.sect.hotelDefault': 'Default Limits',
    'settings.lbl.domDefault': 'Domestic Default',
    'settings.lbl.intlDefault': 'Intl Default',
    'settings.sect.zones': 'Special City Zones (Tiers)',
    'settings.btn.addZone': '+ Add Zone',
    'settings.lbl.zoneName': 'Zone Name',
    'settings.lbl.cities': 'Cities (Comma Sep)',
    'settings.lbl.limit': 'Limit',
    'settings.lbl.currency': 'Currency',

    'settings.sect.doa': 'Approval Thresholds',
    'settings.lbl.deptHead': 'Department Head Limit',
    'settings.desc.deptHead': 'Triggers L2 Approval',
    'settings.lbl.exec': 'CFO / COO Limit',
    'settings.desc.exec': 'Triggers L3 Approval',

    'settings.sect.ai': 'AI Provider Configuration',
    'settings.lbl.apiKey': 'API Key',
    'settings.lbl.model': 'Model Name',
    'settings.lbl.providerSelect': 'Select Provider to Configure',
    'settings.sect.features': 'Feature Mapping',
    'settings.desc.features': 'Assign specific AI providers to different system features.',

    // --- Common Terms ---
    'common.domestic': 'Domestic',
    'common.international': 'International',
    'common.self': 'Myself',
    'common.employee': 'Employee',
    'common.client': 'Client/Guest',
    'status.Draft': 'Draft',
    'status.Submitted': 'Submitted',
    'status.Quotation Pending': 'Quotation Pending',
    'status.Waiting Selection': 'Waiting Selection', // NEW
    'status.Pending Approval': 'Pending Approval',
    'status.Approved': 'Approved',
    'status.Rejected': 'Rejected',
    'status.Booked': 'Booked',
    'status.Completed': 'Completed'
  },
  zh: {
    // --- Layout ---
    'app.title': 'CDG 差旅门户',
    'role': '角色',
    'sign_out': '登出',
    'dashboard': '仪表板',
    'new_request': '新申请',
    'my_requests': '我的申请',
    'settings': '设置',

    // --- Chat ---
    'chat.title': 'CDG 差旅助手',
    'chat.welcome': '你好！我是 CDG 差旅助手。\n我可以帮你创建差旅申请或查询状态。',
    'chat.placeholder': '输入信息... (支持 泰/英/中)',
    'chat.online': '在线',
    'chat.quick.stats': '我的统计 📊',
    'chat.quick.policy': '查询政策 🛡️',
    'chat.quick.create': '创建申请 ✈️',
    'chat.error': '抱歉，系统出错。',
    'chat.slip.title': '差旅申请单',
    'chat.slip.id': '单据编号',
    'chat.slip.dest': '目的地',
    'chat.slip.date': '出行日期',
    'chat.slip.cost': '预计费用',
    'chat.slip.status': '当前状态',
    'chat.draft.review': '审核草稿',
    'chat.draft.submit': '确认提交',
    'chat.draft.edit': '编辑',

    // --- Dashboard ---
    'dash.title': '企业差旅管理门户',
    'dash.costCenter': '成本中心',
    'dash.btn.create': '创建申请',
    'dash.stat.newReq': '新申请',
    'dash.stat.pendingQuote': '待报价',
    'dash.stat.processed': '已处理',
    'dash.stat.policyFlag': '违反政策',
    'dash.stat.activeTrips': '进行中的行程',
    'dash.stat.approvalsWaiting': '待审批',
    'dash.stat.totalSpend': '总支出 (今年)',
    'dash.stat.slaCompliance': 'SLA 合规率',
    'dash.ads.tab.inbox': '收件箱',
    'dash.ads.tab.all': '所有申请',
    'dash.ads.export': '导出 / 打印',
    'dash.ads.caughtUp': '全部处理完毕！没有新申请。',
    'dash.list.recent': '最近的申请',
    'dash.list.viewAll': '查看全部',
    'dash.table.id': '编号',
    'dash.table.detail': '详情',
    'dash.table.type': '类型',
    'dash.table.status': '状态',
    'dash.table.cost': '费用',
    'dash.table.actions': '操作',

    // --- New Request Form ---
    'form.step.travelers': '申请人与旅客',
    'form.step.trip': '行程信息',
    'form.step.services': '服务需求',
    'form.step.review': '审查提交',
    'form.cancel': '取消',
    'form.next': '下一步',
    'form.back': '返回',
    'form.submit': '提交申请',
    'form.update': '更新申请',
    'form.whoTraveling': '为谁申请？',
    'form.travelType': '旅行类型',
    'form.addPerson': '添加旅客',
    
    // Traveler Details
    'form.label.title': '称谓',
    'form.label.fullName': '全名',
    'form.label.empId': '员工编号',
    'form.label.dept': '部门',
    'form.label.company': '公司',
    'form.label.grade': '职级',
    'form.label.position': '职位',
    'form.label.mobile': '联系电话',
    'form.label.email': '电子邮件',
    'form.label.dob': '出生日期',
    'form.label.passport': '护照号码',
    'form.label.passportExpiry': '护照有效期',

    'form.label.origin': '出发地',
    'form.label.dest': '目的地',
    'form.label.start': '开始日期',
    'form.label.end': '结束日期',
    'form.label.purpose': '出差目的',
    'form.btn.aiJustification': 'AI 生成理由',
    'form.label.project': '项目代码',
    'form.label.costCenter': '成本中心',
    'form.label.estCost': '预计总费用',
    'form.policy.compliant': '符合政策',
    'form.policy.warning': '政策警告',
    'form.approvalWorkflow': '审批流程',

    // --- Request List ---
    'reqList.title': '我的申请',
    'reqList.subtitle': '管理和跟踪您的所有差旅申请。',
    'reqList.searchPlaceholder': '搜索 目的地, ID, 或 姓名...',
    'reqList.filter.all': '全部',
    'reqList.filter.active': '进行中',
    'reqList.filter.completed': '已完成',
    'reqList.empty': '未找到符合条件的申请。',

    // --- Settings (NEW) ---
    'settings.title': '政策与系统配置',
    'settings.subtitle': '管理全球差旅规则、审批流程和系统集成。',
    'settings.btn.save': '保存更改',
    'settings.btn.saved': '已保存！',
    'settings.tab.rules': '差旅规则',
    'settings.tab.system': '系统与 AI',
    'settings.tab.vendors': '供应商',
    
    'settings.subtab.general': '常规与津贴',
    'settings.subtab.flight': '机票政策',
    'settings.subtab.hotel': '酒店分级',
    'settings.subtab.doa': '审批限额 (DOA)',

    'settings.sect.global': '全球津贴标准',
    'settings.lbl.mileage': '里程费率 (泰铢/公里)',
    'settings.lbl.advBooking': '提前预订 (国际天数)',
    'settings.sect.perDiem': '每日津贴费率',
    
    'settings.sect.flightRules': '机票资格规则',
    'settings.btn.addRule': '+ 添加规则',
    'settings.desc.flight': '规则从上到下匹配。定义职级（例如：10-12 员工）。',
    'settings.lbl.minDuration': '最短飞行时间 (小时)',
    'settings.lbl.cabin': '允许舱位',
    'settings.lbl.grades': '职级 (逗号分隔)',

    'settings.sect.hotelDefault': '默认限额',
    'settings.lbl.domDefault': '国内默认',
    'settings.lbl.intlDefault': '国际默认',
    'settings.sect.zones': '特殊城市区域 (Tiers)',
    'settings.btn.addZone': '+ 添加区域',
    'settings.lbl.zoneName': '区域名称',
    'settings.lbl.cities': '城市列表 (逗号分隔)',
    'settings.lbl.limit': '限额',
    'settings.lbl.currency': '货币',

    'settings.sect.doa': '审批阈值',
    'settings.lbl.deptHead': '部门主管限额',
    'settings.desc.deptHead': '触发二级审批',
    'settings.lbl.exec': 'CFO / COO 限额',
    'settings.desc.exec': '触发三级审批',

    'settings.sect.ai': 'AI 提供商配置',
    'settings.lbl.apiKey': 'API Key',
    'settings.lbl.model': '模型名称',
    'settings.lbl.providerSelect': '选择要配置的提供商',
    'settings.sect.features': '功能映射 (Feature Mapping)',
    'settings.desc.features': '指定不同系统功能使用的 AI 提供商',

    // --- Common Terms ---
    'common.domestic': '国内',
    'common.international': '国际',
    'common.self': '本人',
    'common.employee': '员工',
    'common.client': '客户/访客',
    'status.Draft': '草稿',
    'status.Submitted': '已提交',
    'status.Quotation Pending': '待报价',
    'status.Waiting Selection': '待选择方案', // NEW
    'status.Pending Approval': '待审批',
    'status.Approved': '已批准',
    'status.Rejected': '已拒绝',
    'status.Booked': '已预订',
    'status.Completed': '已完成'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('th');

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return React.createElement(
    LanguageContext.Provider,
    { value: { language, setLanguage, t } },
    children
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
