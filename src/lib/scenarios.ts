export const scenarios = [
  { code: "SCN-B2B-CONTACT", name: "客户和供应商联系人", description: "项目交付、采购、客户关系和企业联系人管理", icon: "briefcase", recommended: "B2B" },
  { code: "SCN-HR-EMPLOYEE", name: "员工管理", description: "入职、薪酬、考勤、绩效和离职管理", icon: "users", recommended: "internal_only" },
  { code: "SCN-HR-RECRUIT", name: "招聘与候选人", description: "简历收集、面试和人才库", icon: "user-search", recommended: "internal_only" },
  { code: "SCN-WEBSITE-CONTACT", name: "官网联系表单", description: "咨询、留言、产品试用和商务联系", icon: "globe", recommended: "both" },
  { code: "SCN-CONSUMER-MEMBER", name: "消费者或会员", description: "注册、会员权益、订单和客户服务", icon: "badge", recommended: "B2C" },
  { code: "SCN-MARKETING", name: "营销与活动", description: "邮件、短信、活动报名和客户培育", icon: "megaphone", recommended: "both" },
  { code: "SCN-VISITOR", name: "访客与门禁", description: "访客预约、门禁和公共区域视频", icon: "door", recommended: "both" },
  { code: "SCN-OTHER", name: "其他业务", description: "通过访谈记录尚未预设的业务", icon: "plus", recommended: "both" }
] as const;
