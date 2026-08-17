import type { AssessmentRun, AuditItemDefinition, AuditSignal, BusinessDocument, EnterpriseProfile, PipiaInstance, ProcessingActivity, TaskItem } from "./types";

export const auditGroups = [
  { code: "G1", name: "收集、使用和告知", description: "为什么使用个人信息，以及是否已经向相关人员说清楚。" },
  { code: "G2", name: "合作方和信息流转", description: "共同处理、委托服务商、对外提供及主体变化。" },
  { code: "G3", name: "特殊信息和高风险场景", description: "自动化决策、公开、监控、敏感信息、未成年人和境外访问。" },
  { code: "G4", name: "删除和个人请求", description: "如何处理查询、更正、删除和规则解释等请求。" },
  { code: "G5", name: "内部管理和安全措施", description: "制度、权限、培训和负责人履职。" },
  { code: "G6", name: "影响评估和安全事件", description: "影响评估、应急准备和事件响应。" }
];

export const auditItems: AuditItemDefinition[] = [
  { code: "A01", number: 1, groupCode: "G1", title: "处理个人信息的依据", question: "每项业务为什么可以使用这些个人信息，是否已经说得清楚？", help: "需要能说明具体业务目的、必要范围，以及依据同意、合同履行或其他适用情形处理。", evidenceExamples: ["业务处理活动清单", "同意记录", "合同或服务规则"],
    officialIntro: "对个人信息处理活动的合法性基础进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "基于个人同意处理个人信息的，是否取得个人同意，该同意是否由个人在充分知情的前提下自愿、明确作出；",
      "基于个人同意处理个人信息的，个人信息的处理目的、处理方式、处理的个人信息种类发生变更的，是否重新取得个人同意；",
      "基于个人同意处理个人信息的，是否依照法律、行政法规取得个人单独同意或者书面同意；",
      "处理个人信息未取得个人同意的，是否属于法律、行政法规规定不需要取得个人同意的情形。"
    ] },
  { code: "A02", number: 2, groupCode: "G1", title: "个人信息处理规则", question: "是否已经形成与实际业务一致的个人信息处理规则？", help: "处理规则应覆盖实际收集的信息、目的、方式、保存期限、个人权利和联系渠道。", evidenceExamples: ["当前发布的个人信息处理规则", "历史版本", "发布记录"],
    officialIntro: "对个人信息处理规则进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "是否真实、准确、完整地告知个人信息处理者的名称或者姓名和联系方式；",
      "是否以清单等便于查看的形式列明所收集的个人信息及其处理方式和种类；",
      "是否与处理目的直接相关，采取对个人权益影响最小的方式；",
      "是否明确个人信息保存期限或者保存期限的确定方法、到期后的处理方式，以及确定保存期限为实现处理目的所必要的最短时间；",
      "是否明确个人查阅、复制、转移、更正、补充、删除、限制处理个人信息以及注销账号、撤回同意的途径和方法。"
    ] },
  { code: "A03", number: 3, groupCode: "G1", title: "履行告知义务", question: "相关人员在信息被使用前，是否能看到清楚、真实的告知？", help: "检查网站、表单、合同附件、员工告知或线下公示是否与实际做法一致。", evidenceExamples: ["告知页面截图", "员工告知", "表单或合同附件"],
    officialIntro: "对履行告知个人信息处理规则义务进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "个人信息处理者在处理个人信息前，是否以显著方式、清晰易懂的语言真实、准确、完整地向个人告知个人信息处理规则；",
      "告知文本的大小、字体和颜色是否便于个人完整阅读告知事项；",
      "线下告知是否通过标注、说明等多种方式向个人履行告知义务；",
      "在线告知是否提供文本信息或者通过适当方式向个人履行告知义务；",
      "个人信息处理规则发生变更的，是否将变更内容及时告知个人；",
      "处理个人信息不需要告知的，是否属于法律、行政法规规定应当保密或者不需要告知的情形。"
    ] },
  { code: "A04", number: 4, groupCode: "G2", title: "共同处理", question: "是否与其他单位共同决定为什么、怎样处理个人信息？", help: "如存在，应明确双方责任以及个人如何行使权利；没有则说明为什么不适用。", evidenceExamples: ["合作协议", "双方责任约定", "业务说明"],
    officialIntro: "对与其他个人信息处理者共同处理个人信息进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "是否约定各自的权利义务；",
      "个人信息权益保护机制；",
      "个人信息安全事件报告机制；",
      "其他法律、行政法规规定需要约定的权利和义务。"
    ] },
  { code: "A05", number: 5, groupCode: "G2", title: "委托处理", question: "使用云服务商或其他受托方时，是否约定处理边界并进行必要监督？", help: "常见情形包括CRM、薪酬、邮件、云存储、短信或外包服务。", evidenceExamples: ["委托处理条款", "服务商清单", "检查记录"],
    officialIntro: "对委托处理个人信息进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "个人信息处理者在委托处理个人信息前，是否开展个人信息保护影响评估；",
      "个人信息处理者与受托人签订的合同，是否与受托人约定了委托处理的目的、期限、方式、个人信息的种类、保护措施以及双方的权利义务等；",
      "个人信息处理者是否采取定期检查等方式，对受托人的个人信息处理活动进行监督。"
    ] },
  { code: "A06", number: 6, groupCode: "G2", title: "主体变更时的信息转移", question: "合并、重组、解散等主体变化时，是否有个人信息交接和通知安排？", help: "当前没有相关事项时可以选择不适用，并说明尚未发生。", evidenceExamples: ["主体变更方案", "通知记录", "删除或交接清单"],
    officialIntro: "存在因合并、重组、分立、解散、被宣告破产等原因需要转移个人信息情形的，应当重点审查是否向个人告知接收方的名称或者姓名和联系方式。",
    officialSubItems: [] },
  { code: "A07", number: 7, groupCode: "G2", title: "向其他处理者提供", question: "把个人信息提供给其他独立单位前，是否完成必要告知、同意和评估？", help: "需要区分受托服务商与独立决定用途的接收方。", evidenceExamples: ["接收方清单", "单独同意记录", "影响评估"],
    officialIntro: "对向其他个人信息处理者提供所处理的个人信息进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "基于个人同意处理个人信息的，是否取得个人的单独同意；",
      "是否向个人告知接收方的名称或者姓名、联系方式、处理目的、处理方式和个人信息的种类，法律、行政法规规定应当保密或者不需要告知的除外；",
      "是否事前进行个人信息保护影响评估。"
    ] },
  { code: "A08", number: 8, groupCode: "G3", title: "自动化决策", question: "是否使用个人信息自动决定推荐、价格、资格或其他对个人有影响的结果？", help: "仅使用普通办公软件并不当然属于自动化决策；没有相关功能时可选择不适用。", evidenceExamples: ["功能说明", "算法或规则说明", "退出入口"],
    officialIntro: "对利用自动化决策处理个人信息进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "自动化决策的透明度，以及自动化决策的结果是否公平、公正；",
      "是否事前告知个人自动化决策处理个人信息的种类及可能带来的影响；",
      "是否事前进行个人信息保护影响评估；",
      "是否向用户提供保障机制，以便个人通过便捷方式拒绝通过自动化决策方式作出对个人权益有重大影响的决定，并要求个人信息处理者就通过自动化决策方式作出对用户个人权益有重大影响的决定予以说明；",
      "向个人进行信息推送、商业营销的，是否同时提供不针对个人特征的选项，或者提供便捷的拒绝自动化决策服务的方式；",
      "是否采取了有效措施，防止自动化决策根据消费者的偏好、交易习惯等对个人在交易条件上实行不合理的差别待遇；",
      "其他可能影响自动化决策的透明度和结果公平、公正的事项。"
    ] },
  { code: "A09", number: 9, groupCode: "G3", title: "公开个人信息", question: "是否会把个人信息公开展示给不特定的人？", help: "例如官网公开联系人、名单、公示信息或公开发布照片。", evidenceExamples: ["公开页面", "单独同意记录", "影响评估"],
    officialIntro: "对基于个人同意公开个人信息进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "个人信息处理者公开其处理的个人信息前是否取得个人单独同意，该授权是否真实、有效，是否存在违背个人意愿将个人信息予以公开的情况；",
      "个人信息处理者公开个人信息前，是否进行个人信息保护影响评估。"
    ] },
  { code: "A10", number: 10, groupCode: "G3", title: "公共场所图像和身份识别", question: "门店、办公场所等区域是否使用监控、图像采集或身份识别设备？", help: "如存在，应确认必要性、显著提示、使用范围和访问权限。", evidenceExamples: ["现场标识照片", "设备清单", "查看权限记录"],
    officialIntro: "在公共场所安装图像收集、个人身份识别设备的，应当重点对安装图像收集、个人信息身份识别设备的合法性及所收集个人信息的用途进行审查。审查内容包括但不限于：",
    officialSubItems: [
      "是否为维护公共安全所必需，是否为商业目的处理所收集的个人信息；",
      "是否设置了显著的提示标识；",
      "个人信息处理者所收集的个人图像、身份识别信息用于维护公共安全以外用途的，是否取得个人单独同意。"
    ] },
  { code: "A11", number: 11, groupCode: "G3", title: "使用已公开的个人信息", question: "是否从互联网或其他公开渠道取得个人信息并用于业务？", help: "需要确认使用范围是否合理，以及是否尊重个人明确拒绝。", evidenceExamples: ["信息来源说明", "采集规则", "拒绝处理记录"],
    officialIntro: "对处理已公开的个人信息进行合规审计的，应当重点审查是否存在下列违法违规行为：",
    officialSubItems: [
      "向已公开个人信息中的电子邮箱、手机号等发送与其公开目的无关的商业信息；",
      "利用已公开的个人信息从事网络暴力、传播网络谣言和虚假信息等活动；",
      "处理个人明确拒绝处理的已公开个人信息；",
      "对个人权益有重大影响，未取得个人同意；",
      "收集、留存或处理已公开个人信息的规模、时间或使用目的超出合理范围。"
    ] },
  { code: "A12", number: 12, groupCode: "G3", title: "敏感个人信息", question: "身份证件、金融账户、健康、生物识别等敏感信息是否确有必要并得到特别保护？", help: "涉及时应检查必要性、特别告知、单独同意、影响评估和保护措施。", evidenceExamples: ["敏感信息清单", "单独同意", "影响评估"],
    officialIntro: "对处理敏感个人信息进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "基于个人同意处理个人信息的，处理生物识别、宗教信仰、特定身份、医疗健康、金融账户、行踪轨迹等敏感个人信息，是否事前取得个人的单独同意；",
      "基于个人同意处理个人信息的，处理不满十四周岁未成年人的个人信息，是否事前取得未成年人的父母或者其他监护人的同意；",
      "处理敏感个人信息的目的、方式、范围是否合法、正当、必要；",
      "是否在事前进行个人信息保护影响评估；",
      "是否向个人告知处理敏感个人信息的必要性以及对个人权益的影响，法律、行政法规规定应当保密或者不需要告知的除外；",
      "法律、行政法规规定应当取得书面同意的，是否取得书面同意；",
      "是否遵守法律、行政法规对处理敏感个人信息的限制性规定。"
    ] },
  { code: "A13", number: 13, groupCode: "G3", title: "不满十四周岁未成年人", question: "是否可能处理不满十四周岁未成年人的个人信息？", help: "涉及时需要监护人同意、专门规则和更严格的保护措施。", evidenceExamples: ["年龄判断方式", "监护人同意", "未成年人专门规则"],
    officialIntro: "对处理不满十四周岁未成年人个人信息进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "是否制定专门的个人信息处理规则；",
      "是否向未成年人及其监护人告知未成年人个人信息的处理目的、处理方式、处理必要性，以及处理个人信息的种类、所采取的保护措施等，法律、行政法规规定不需要告知的除外；",
      "基于个人同意处理个人信息，是否存在强制要求未成年人或者其监护人同意处理非必要个人信息的行为。"
    ] },
  { code: "A14", number: 14, groupCode: "G3", title: "向境外提供个人信息", question: "信息是否存到境外，或可能被境外总部、管理员、服务商远程查看？", help: "不能只看服务器位置，还要考虑境外人员和系统权限。", evidenceExamples: ["系统部署说明", "境外访问权限", "影响评估"],
    officialIntro: "对向境外提供个人信息进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "关键信息基础设施运营者向境外提供个人信息是否经过国家网信部门组织的安全评估，法律、行政法规、国家网信部门另有规定的，从其规定；",
      "关键信息基础设施运营者以外的数据处理者自当年1月1日起累计向境外提供100万人以上个人信息（不含敏感个人信息）或者1万人以上敏感个人信息是否经过国家网信部门组织的安全评估，法律、行政法规、国家网信部门另有规定的，从其规定；",
      "关键信息基础设施运营者以外的数据处理者自当年1月1日起累计向境外提供10万人以上、不满100万人个人信息（不含敏感个人信息）或者不满1万人敏感个人信息的，是否按照国家网信部门的规定，经个人信息保护认证或者按照国家网信部门制定的标准合同与境外接收方签订合同并向所在地省级网信部门备案，或者符合法律、行政法规、国家网信部门规定的其他条件；",
      "存在向外国司法或者执法机构提供存储于中华人民共和国境内个人信息情形的，是否经过中华人民共和国主管机关批准；",
      "是否向被列入限制或者禁止个人信息提供清单的组织和个人提供个人信息。"
    ] },
  { code: "A15", number: 15, groupCode: "G4", title: "删除个人信息", question: "达到删除条件后，是否知道应在什么系统和文件中执行删除？", help: "不能立即删除的，应说明保存依据并限制其他用途。", evidenceExamples: ["保存期限清单", "删除记录", "系统设置截图"],
    officialIntro: "对个人信息删除权保障情况进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "个人信息处理目的是否已实现、无法实现或者为实现处理目的不再必要；",
      "个人信息处理者是否停止提供产品或者服务，或者个人是否已注销账号；",
      "保存期限是否已届满；",
      "个人是否撤回同意；",
      "个人信息处理者是否违反法律、行政法规或者违反约定处理个人信息；",
      "应当删除个人信息，但法律、行政法规规定的保存期限未届满，或者删除个人信息从技术上难以实现的，个人信息处理者是否停止除存储和采取必要的安全措施之外的处理。"
    ] },
  { code: "A16", number: 16, groupCode: "G4", title: "个人权利保障机制", question: "个人是否有清楚、方便的渠道提出查询、更正、删除等请求？", help: "B2B联系人、员工和消费者都可能提出个人信息相关请求。", evidenceExamples: ["联系渠道", "请求处理指引", "申请入口"],
    officialIntro: "对保障个人在个人信息处理活动中的权利情况进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "是否建立便捷的个人行使权利的申请受理机制和处理机制；",
      "是否及时响应个人行使权利的申请，是否及时、完整、准确告知处理意见或者执行结果；",
      "拒绝个人行使权利请求的，是否向个人说明理由。"
    ] },
  { code: "A17", number: 17, groupCode: "G4", title: "响应请求和解释规则", question: "收到个人请求后，是否有登记、核验、办理、答复和留痕步骤？", help: "拒绝或不能立即处理时，应能说明理由。", evidenceExamples: ["请求台账", "答复记录", "处理指引"],
    officialIntro: "对响应个人行使权利申请进行合规审计的，应当重点对下列内容进行评价：",
    officialSubItems: [
      "个人信息处理者是否提供便捷的方式和途径，接受、处理个人关于个人信息处理规则解释说明的要求；",
      "接到个人的要求后，个人信息处理者是否在合理的时间内，使用通俗易懂的语言对其个人信息处理规则作出解释说明。"
    ] },
  { code: "A18", number: 18, groupCode: "G5", title: "内部管理制度和操作要求", question: "员工是否知道可以怎样使用个人信息、哪些行为不能做？", help: "小型处理者可以把要求纳入现有管理文件，不必建设复杂制度体系。", evidenceExamples: ["内部管理要求", "岗位职责", "员工承诺"],
    officialIntro: "对内部管理制度和操作规程进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "个人信息保护工作的方针、目标、原则是否符合法律、行政法规规定；",
      "个人信息保护组织架构、人员配备、行为规范、管理责任是否与应当履行的个人信息保护责任相适应；",
      "是否根据个人信息的种类、来源、敏感程度、用途等，对个人信息进行分类；",
      "是否建立个人信息安全事件应急响应机制；",
      "是否建立个人信息保护影响评估制度、合规审计制度；",
      "是否建立畅通的个人信息保护投诉举报受理流程；",
      "是否合理制定个人信息处理操作权限；",
      "是否制定实施个人信息保护安全教育和培训计划；",
      "是否建立个人信息保护负责人及相关人员履职评价制度；",
      "是否建立个人信息违法处理责任制度；",
      "法律、行政法规规定的其他事项。"
    ] },
  { code: "A19", number: 19, groupCode: "G5", title: "技术保护措施", question: "账号、权限、备份、日志等措施是否与实际风险相适应？", help: "至少确认谁能查看、离职后怎样关停权限、重要操作是否留痕。", evidenceExamples: ["权限清单", "系统设置截图", "备份或日志记录"],
    officialIntro: "对采取的技术措施的有效性进行评价的，评价内容包括但不限于：",
    officialSubItems: [
      "是否采取相应安全技术措施实现个人信息的保密性、完整性、可用性；",
      "是否采取加密、去标识化等安全技术措施，确保在不借助额外信息的情况下，消除或者降低个人信息的可识别性；",
      "采取的安全技术措施能否合理确定有关人员查阅、复制、传输个人信息等的操作权限，减少个人信息在处理过程中未经授权的访问和滥用风险。"
    ] },
  { code: "A20", number: 20, groupCode: "G5", title: "教育培训", question: "接触个人信息的员工是否接受过与岗位相关的提醒或培训？", help: "小型处理者可以采用简短培训、操作提示和确认记录。", evidenceExamples: ["培训材料", "签到或确认记录", "考核结果"],
    officialIntro: "对教育培训计划的制定和实施情况进行合规审计时，应当重点对下列事项进行评价：",
    officialSubItems: [
      "是否按计划对管理人员、技术人员、操作人员、全员开展相应的安全教育和培训，是否对相应人员的个人信息保护意识和技能进行考核；",
      "培训内容、方式、对象、频率等能否满足个人信息保护需要。"
    ] },
  { code: "A21", number: 21, groupCode: "G5", title: "个人信息保护负责人", question: "是否已经明确由谁负责协调个人信息保护工作？", help: "需要有负责人、职责和可用的联系渠道。", evidenceExamples: ["负责人任命或职责", "企业档案", "公开联系渠道"],
    officialIntro: "对指定的个人信息保护负责人履职情况进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "个人信息保护负责人是否具有相关的工作经历和专业知识，熟悉个人信息保护相关法律、行政法规；",
      "个人信息保护负责人是否具有明确清晰的职责，是否被赋予充分的权限协调个人信息处理者内部相关部门与人员；",
      "个人信息保护负责人在个人信息处理重大事项决策前是否有权提出相关意见和建议；",
      "个人信息保护负责人是否有权对个人信息处理者内部个人信息处理的不合规操作进行制止和采取必要的纠正措施；",
      "个人信息处理者是否公开个人信息保护负责人的联系方式，并将个人信息保护负责人的姓名、联系方式等报送保护部门。"
    ] },
  { code: "A22", number: 22, groupCode: "G6", title: "个人信息保护影响评估", question: "触发影响评估的业务是否已在开展前完成评估并留档？", help: "敏感信息、自动化决策、对外提供、公开、委托处理、境外提供等情况需要重点判断。", evidenceExamples: ["影响评估表", "事实快照", "整改记录"],
    officialIntro: "对开展个人信息保护影响评估情况进行合规审计时，应当重点对影响评估开展情况和评估内容进行审查：",
    officialSubItems: [
      "是否依照法律、行政法规的规定，在进行对个人权益具有重大影响的个人信息处理活动前进行个人信息保护影响评估；",
      "是否对个人信息的处理目的、处理方式等进行合法、正当、必要评估；",
      "是否对个人权益的影响及安全风险进行评估；",
      "是否对所采取的保护措施的合法性、有效性，以及与风险程度的适应性进行评估。"
    ] },
  { code: "A23", number: 23, groupCode: "G6", title: "安全事件应急准备", question: "发生误发、账号被盗或信息泄露时，员工是否知道先做什么、找谁？", help: "应至少有报告渠道、立即止损步骤、影响判断和通知决策。", evidenceExamples: ["应急处置要求", "联系人清单", "演练或培训记录"],
    officialIntro: "对个人信息安全事件应急预案进行合规审计的，应当对应急预案的全面性、有效性、可执行性作出评价，包括但不限于下列内容：",
    officialSubItems: [
      "是否结合业务实际，对面临的个人信息安全风险作出系统评估和预测；",
      "总体要求、基本策略，组织机构、人员，技术、物资保障，指挥处置程序，应急和支持措施等是否足以应对预测的风险；",
      "是否对相关人员进行应急预案培训，定期对应急预案进行演练。"
    ] },
  { code: "A24", number: 24, groupCode: "G6", title: "安全事件响应处置", question: "如果发生过安全事件，是否及时查明、补救、通知并复盘？", help: "没有发生过事件时，可结合现有响应机制说明情况。", evidenceExamples: ["事件时间线", "补救记录", "通知和复盘材料"],
    officialIntro: "对个人信息安全事件应急响应处置情况进行合规审计的，应当重点审查下列事项：",
    officialSubItems: [
      "是否按照应急预案、操作规程及时查明个人信息安全事件的影响、范围和可能造成的危害，分析、确定事件发生的原因，提出防止危害扩大的措施方案；",
      "是否建立通报渠道，在安全事件发生后按照相关规定及时通知保护部门和个人；",
      "是否采取相应措施将个人信息安全事件可能造成的损失和可能产生的危害风险降低到最小。"
    ] }
];

export type AuditContext = {
  enterprise: EnterpriseProfile;
  activities: ProcessingActivity[];
  documents: BusinessDocument[];
  tasks: TaskItem[];
  assessments: AssessmentRun[];
  pipias: PipiaInstance[];
};

const hasDocument = (context: AuditContext, type: string) => context.documents.some(document => document.type === type && document.currentVersion?.status === "effective");
const anyActivity = (context: AuditContext, predicate: (activity: ProcessingActivity) => boolean) => context.activities.some(predicate);

export function buildAuditSignals(code: string, context: AuditContext): AuditSignal[] {
  const complete = context.activities.filter(activity => activity.completeness === 1).length;
  const incomplete = context.activities.length - complete;
  const signals: AuditSignal[] = [];
  if (["A01", "A15"].includes(code)) {
    signals.push({ tone: complete ? "positive" : "neutral", text: `已记录 ${context.activities.length} 项业务，其中 ${complete} 项完成事实确认。` });
    if (incomplete) signals.push({ tone: "warning", text: `${incomplete} 项业务尚未完整确认，可能影响本项判断。` });
  }
  if (["A02", "A03"].includes(code)) signals.push({ tone: hasDocument(context, "privacy_notice") || hasDocument(context, "b2b_contact_notice") ? "positive" : "warning", text: hasDocument(context, "privacy_notice") || hasDocument(context, "b2b_contact_notice") ? "已建立对外个人信息告知材料。" : "尚未找到对外个人信息处理规则或联系人告知。" });
  if (["A04", "A05", "A07"].includes(code)) signals.push({ tone: "neutral", text: anyActivity(context, activity => activity.facts.recipients.some(item => item !== "不向外部提供")) ? "部分业务记录了外部接收方或服务商，需要进一步区分处理关系。" : "现有业务未明确记录外部接收方，仍需负责人确认。" });
  if (code === "A08") signals.push({ tone: anyActivity(context, activity => activity.facts.automatedDecision === "yes") ? "warning" : "neutral", text: anyActivity(context, activity => activity.facts.automatedDecision === "yes") ? "已有业务确认使用自动化决策，需要核对告知、选择权和影响评估。" : anyActivity(context, activity => activity.facts.automatedDecision === "unknown") ? "部分业务尚未确认是否使用自动化决策。" : "现有已确认业务填写为不使用自动化决策。" });
  if (code === "A10") signals.push({ tone: anyActivity(context, activity => activity.facts.systems.includes("门禁或监控")) ? "warning" : "neutral", text: anyActivity(context, activity => activity.facts.systems.includes("门禁或监控")) ? "已有业务使用门禁或监控，需要核对设备和现场提示。" : "现有业务未记录门禁或监控系统。" });
  if (code === "A11") signals.push({ tone: anyActivity(context, activity => activity.facts.collectionChannels.includes("公开渠道")) ? "warning" : "neutral", text: anyActivity(context, activity => activity.facts.collectionChannels.includes("公开渠道")) ? "有业务从公开渠道收集信息。" : "现有业务未记录从公开渠道收集。" });
  if (code === "A12") signals.push({ tone: anyActivity(context, activity => activity.facts.sensitiveInformation !== "no") || context.enterprise.sensitiveCategories.length > 0 ? "warning" : "positive", text: anyActivity(context, activity => activity.facts.sensitiveInformation !== "no") || context.enterprise.sensitiveCategories.length > 0 ? "存在敏感信息或尚未确认的情况。" : "现有已确认业务均填写为不涉及敏感个人信息。" });
  if (code === "A13") signals.push({ tone: anyActivity(context, activity => activity.facts.minorsInvolved !== "no") || context.enterprise.minorsPossible !== "no" ? "warning" : "positive", text: anyActivity(context, activity => activity.facts.minorsInvolved !== "no") || context.enterprise.minorsPossible !== "no" ? "存在未成年人信息或尚未确认的情况。" : "现有档案填写为不涉及不满十四周岁未成年人。" });
  if (code === "A14") signals.push({ tone: anyActivity(context, activity => activity.facts.crossBorderAccess !== "no") || context.enterprise.crossBorder !== "no" ? "warning" : "positive", text: anyActivity(context, activity => activity.facts.crossBorderAccess !== "no") || context.enterprise.crossBorder !== "no" ? "存在境外访问或尚未确认的情况。" : "现有档案填写为不涉及境外存储或访问。" });
  if (["A16", "A17"].includes(code)) signals.push({ tone: hasDocument(context, "rights_guide") ? "positive" : "warning", text: hasDocument(context, "rights_guide") ? "已建立个人信息相关请求处理指引。" : "尚未找到个人信息相关请求处理指引。" });
  if (code === "A18") signals.push({ tone: hasDocument(context, "internal_policy") ? "positive" : "warning", text: hasDocument(context, "internal_policy") ? "已建立个人信息保护内部管理要求。" : "尚未找到内部管理要求。" });
  if (code === "A21") signals.push({ tone: context.enterprise.privacyContactName && context.enterprise.privacyContactChannel ? "positive" : "warning", text: context.enterprise.privacyContactName && context.enterprise.privacyContactChannel ? `企业档案已记录负责人：${context.enterprise.privacyContactName}。` : "负责人姓名或联系渠道尚未完整填写。" });
  if (code === "A22") signals.push({ tone: context.pipias.some(item => item.status === "signed") ? "positive" : "neutral", text: context.pipias.some(item => item.status === "signed") ? `已有 ${context.pipias.filter(item => item.status === "signed").length} 份影响评估完成确认。` : "尚无已确认归档的影响评估。" });
  if (code === "A23") signals.push({ tone: hasDocument(context, "incident_plan") ? "positive" : "warning", text: hasDocument(context, "incident_plan") ? "已建立个人信息安全事件应急处置要求。" : "尚未找到安全事件应急处置要求。" });
  if (!signals.length) signals.push({ tone: "neutral", text: "系统暂无足够记录自动判断，请根据实际情况确认。" });
  return signals;
}
