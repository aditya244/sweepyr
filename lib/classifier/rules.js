import { GoogleGenerativeAI } from "@google/generative-ai";

const KNOWN_DOMAINS = {
  // ─── Indian Banks ───────────────────────────────────────────
  // NOTE: bank / NBFC / insurance / credit-card / BNPL domains are NOT
  // listed here — they're attachment-sensitive (see BANK_ATTACHMENT_DOMAINS
  // below). A flat entry here would always win over the attachment check,
  // which is exactly the bug that made the old attachment logic dead code.
  "info.paytm.com": { category: "Transactions", confidence: 0.97 },

  // ─── Investments / Mutual Funds ──────────────────────────────
  "mailer.moneycontrol.com": { category: "Newsletter", confidence: 0.95 },

  // ─── Indian UPI / Payments / Wallets ────────────────────────
  "paytm.com": { category: "Transactions", confidence: 0.97 },
  "phonepe.com": { category: "Transactions", confidence: 0.97 },
  "gpay.app": { category: "Transactions", confidence: 0.97 },
  "razorpay.com": { category: "Transactions", confidence: 0.97 },
  "mobikwik.com": { category: "Transactions", confidence: 0.97 },
  "freecharge.in": { category: "Transactions", confidence: 0.97 },
  "amazonpay.in": { category: "Transactions", confidence: 0.97 },

  // ─── Insurance marketplaces (aggregators, not primary document senders —
  // left flat, unlike direct insurers which are attachment-sensitive) ────
  "policybazaar.com": { category: "Finance", confidence: 0.95 },
  "acko.com": { category: "Finance", confidence: 0.95 },

  // ─── Indian Job Portals ──────────────────────────────────────
  'naukri.com':          { category: 'Jobs & Careers', confidence: 0.95 },
'naukrimail.com':      { category: 'Jobs & Careers', confidence: 0.95 },
'indeed.com':          { category: 'Jobs & Careers', confidence: 0.95 },
'match.indeed.com':    { category: 'Jobs & Careers', confidence: 0.95 },
'shine.com':           { category: 'Jobs & Careers', confidence: 0.95 },
'monster.com':         { category: 'Jobs & Careers', confidence: 0.95 },
'monsterindia.com':    { category: 'Jobs & Careers', confidence: 0.95 },
'internshala.com':     { category: 'Jobs & Careers', confidence: 0.95 },
'hirist.com':          { category: 'Jobs & Careers', confidence: 0.95 },
'cutshort.io':         { category: 'Jobs & Careers', confidence: 0.95 },
'instahyre.com':       { category: 'Jobs & Careers', confidence: 0.95 },
'foundit.in':          { category: 'Jobs & Careers', confidence: 0.95 },
'careercamp.codingninjas.com': { category: 'Jobs & Careers', confidence: 0.93 },
'linkedin.com':        { category: 'Jobs & Careers', confidence: 0.95 },
// LinkedIn is more job-related than social for most Indian users

  // ─── Indian E-commerce ──────────────────────────────────────
  "flipkart.com": { category: "Receipts", confidence: 0.95 },
  "amazon.in": { category: "Receipts", confidence: 0.95 },
  "amazon.com": { category: "Receipts", confidence: 0.9 },
  "myntra.com": { category: "Promotions", confidence: 0.95 },
  "ajio.com": { category: "Promotions", confidence: 0.95 },
  "meesho.com": { category: "Promotions", confidence: 0.95 },
  "nykaa.com": { category: "Promotions", confidence: 0.95 },
  "tatacliq.com": { category: "Receipts", confidence: 0.93 },
  "snapdeal.com": { category: "Promotions", confidence: 0.93 },
  "bigbasket.com": { category: "Receipts", confidence: 0.95 },
  "blinkit.com": { category: "Receipts", confidence: 0.95 },
  "zepto.in": { category: "Receipts", confidence: 0.95 },
  "jiomart.com": { category: "Receipts", confidence: 0.95 },

  // ─── Food Delivery ──────────────────────────────────────────
  "swiggy.in": { category: "Receipts", confidence: 0.97 },
  "zomato.com": { category: "Receipts", confidence: 0.97 },

  // ─── Travel ─────────────────────────────────────────────────
  // Stays flat — attachment (e-ticket/itinerary) doesn't change the
  // category, only isTravelPromotional() below pulls marketing mail out.
  "makemytrip.com": { category: "Travel", confidence: 0.97 },
  "goibibo.com": { category: "Travel", confidence: 0.97 },
  "irctc.co.in": { category: "Travel", confidence: 0.98 },
  "indigo.in": { category: "Travel", confidence: 0.97 },
  "airindia.in": { category: "Travel", confidence: 0.97 },
  "spicejet.com": { category: "Travel", confidence: 0.97 },
  "airasia.com": { category: "Travel", confidence: 0.97 },
  "akasaair.com": { category: "Travel", confidence: 0.97 },
  "vistara.com": { category: "Travel", confidence: 0.97 },
  "cleartrip.com": { category: "Travel", confidence: 0.97 },
  "yatra.com": { category: "Travel", confidence: 0.97 },
  "ixigo.com": { category: "Travel", confidence: 0.97 },
  "oyo.com": { category: "Travel", confidence: 0.95 },
  "oyorooms.com": { category: "Travel", confidence: 0.95 },
  "redbus.in": { category: "Travel", confidence: 0.97 },
  "abhibus.com": { category: "Travel", confidence: 0.95 },
  "booking.com": { category: "Travel", confidence: 0.95 },
  "airbnb.com": { category: "Travel", confidence: 0.95 },
  "goindigo.in": { category: "Travel", confidence: 0.97 },
  "promo.airindiaexpress.com": { category: "Travel", confidence: 0.95 },
  "travel.redbus.my": { category: "Travel", confidence: 0.97 },
  "tajhotels.com": { category: "Travel", confidence: 0.95 },

  // ─── Utilities / Bills ──────────────────────────────────────
  "jio.com": { category: "Notifications", confidence: 0.93 },
  "airtel.in": { category: "Notifications", confidence: 0.93 },
  "airtelindia.com": { category: "Notifications", confidence: 0.93 },
  "vodafone.in": { category: "Notifications", confidence: 0.93 },
  "bsnl.co.in": { category: "Notifications", confidence: 0.93 },
  "bescom.co.in": { category: "Notifications", confidence: 0.93 },
  "tatapower.com": { category: "Notifications", confidence: 0.93 },
  "adanielectricity.com": { category: "Notifications", confidence: 0.93 },
  "airtel.com": { category: "Notifications", confidence: 0.93 },
  "mailer.airtel.com": { category: "Notifications", confidence: 0.93 },

  // ─── Government / Tax ────────────────────────────────────────
  // Flat, no attachment nuance needed — .gov.in domains essentially never
  // send promotional content, so there's no "default vs escalated" split.
  "incometax.gov.in": { category: "Finance", confidence: 0.97 },
  "epfindia.gov.in": { category: "Finance", confidence: 0.97 },
  "uidai.gov.in": { category: "Finance", confidence: 0.95 },
  "digilocker.gov.in": { category: "Finance", confidence: 0.95 },

  // ─── Ed-tech ────────────────────────────────────────────────
  "byjus.com": { category: "Promotions", confidence: 0.93 },
  "unacademy.com": { category: "Promotions", confidence: 0.93 },
  "coursera.org": { category: "Newsletter", confidence: 0.93 },
  "udemy.com": { category: "Promotions", confidence: 0.93 },
  "simplilearn.com": { category: "Promotions", confidence: 0.93 },
  "upgrad.com": { category: "Promotions", confidence: 0.93 },
  "scaler.com": { category: "Promotions", confidence: 0.93 },
  "pw.live": { category: "Promotions", confidence: 0.93 },
  "vedantu.com": { category: "Promotions", confidence: 0.93 },
  "testbook.com": { category: "Promotions", confidence: 0.93 },

  // ─── Coding practice — closer to GitHub's treatment than course-selling
  // ed-tech: contest reminders / results, not marketing ─────────────────
  "leetcode.com": { category: "Notifications", confidence: 0.9 },
  "hackerrank.com": { category: "Notifications", confidence: 0.9 },
  "codechef.com": { category: "Notifications", confidence: 0.9 },
  "geeksforgeeks.org": { category: "Notifications", confidence: 0.9 },

  // ─── Global Newsletters / Marketing ESPs ────────────────────
  "substack.com": { category: "Newsletter", confidence: 0.98 },
  "mailchimp.com": { category: "Newsletter", confidence: 0.98 },
  "sendgrid.net": { category: "Promotions", confidence: 0.9 },
  "klaviyo.com": { category: "Promotions", confidence: 0.97 },
  "mailgun.org": { category: "Notifications", confidence: 0.85 },
  "constantcontact.com": { category: "Newsletter", confidence: 0.97 },
  "campaign-archive.com": { category: "Newsletter", confidence: 0.97 },
  "amazonses.com": { category: "Notifications", confidence: 0.85 },

  // ─── Social ─────────────────────────────────────────────────
  "twitter.com": { category: "Social", confidence: 0.98 },
  "x.com": { category: "Social", confidence: 0.98 },
  "facebook.com": { category: "Social", confidence: 0.98 },
  "instagram.com": { category: "Social", confidence: 0.98 },
  "youtube.com": { category: "Social", confidence: 0.95 },
  "quora.com": { category: "Social", confidence: 0.95 },
  "reddit.com": { category: "Social", confidence: 0.95 },
  "discord.com": { category: "Social", confidence: 0.95 },
  "medium.com": { category: "Newsletter", confidence: 0.93 },

  // ─── Dating ─────────────────────────────────────────────────
  "tinder.com": { category: "Social", confidence: 0.95 },
  "bumble.com": { category: "Social", confidence: 0.95 },
  "hinge.co": { category: "Social", confidence: 0.95 },
  "trulymadly.com": { category: "Social", confidence: 0.95 },
  "aisle.co": { category: "Social", confidence: 0.95 },
  "quackquack.in": { category: "Social", confidence: 0.95 },
  "woo.co.in": { category: "Social", confidence: 0.95 },

  // ─── Matrimony ──────────────────────────────────────────────
  // Community-specific brands under the Matrimony.com umbrella listed
  // individually since matrimony choice in India often runs along
  // language/community lines and each sends from its own domain.
  "shaadi.com": { category: "Social", confidence: 0.95 },
  "bharatmatrimony.com": { category: "Social", confidence: 0.95 },
  "jeevansathi.com": { category: "Social", confidence: 0.95 },
  "matrimony.com": { category: "Social", confidence: 0.95 },
  "telugumatrimony.com": { category: "Social", confidence: 0.95 },
  "tamilmatrimony.com": { category: "Social", confidence: 0.95 },
  "keralamatrimony.com": { category: "Social", confidence: 0.95 },
  "muslimmatrimony.com": { category: "Social", confidence: 0.95 },
  "punjabimatrimony.com": { category: "Social", confidence: 0.95 },
  "simplymarry.com": { category: "Social", confidence: 0.93 },
  "elitematrimony.com": { category: "Social", confidence: 0.93 },

  // ─── Amazon (sends from many domains) ───────────────────────
  "amazon.in": { category: "Receipts", confidence: 0.93 },
  "amazon.com": { category: "Receipts", confidence: 0.9 },
  "uber.com": { category: "Receipts", confidence: 0.95 },

  "associates.amazon.in": { category: "Promotions", confidence: 0.93 },
  "kdp.amazon.com": { category: "Finance", confidence: 0.93 },
  "gc.email.amazon.in": { category: "Receipts", confidence: 0.97 },
  "payments.amazon.in": { category: "Transactions", confidence: 0.97 },
  "amazonpay.in": { category: "Transactions", confidence: 0.97 },

  // ─── Fitness ─────────────────────────────────────────────────
  "cult.fit": { category: "Notifications", confidence: 0.9 },
  "strava.com": { category: "Notifications", confidence: 0.9 },
  "e.blog.myfitnesspal.com": { category: "Newsletter", confidence: 0.9 },

  // ─── Tech / Developer ────────────────────────────────────────
  "github.com": { category: "Notifications", confidence: 0.95 },
  "mongodb.com": { category: "Notifications", confidence: 0.9 },
  "onedrive.com": { category: "Notifications", confidence: 0.9 },

  // ─── Ed-tech ─────────────────────────────────────────────────
  "careercamp.codingninjas.com": { category: "Promotions", confidence: 0.93 },
  "udacity.com": { category: "Promotions", confidence: 0.9 },

  // ─── Gifting / Vouchers ──────────────────────────────────────
  "updates.igp.com": { category: "Promotions", confidence: 0.93 },
  "alerts.shopwise.giftstacc.com": {
    category: "Notifications",
    confidence: 0.9,
  },
  "shopwise.giftstacc.com": { category: "Notifications", confidence: 0.9 },

  // ─── News / Media ────────────────────────────────────────────
  "yourstory.com": { category: "Newsletter", confidence: 0.93 },

  // ─── Healthcare — pharmacy / medicine ordering ───────────────
  // Treated like e-commerce (Amazon/Bigbasket) — these are order receipts,
  // not documents. Attachment doesn't change the "keep briefly" calculus,
  // unlike the diagnostics domains below.
  "1mg.com": { category: "Receipts", confidence: 0.95 },
  "pharmeasy.in": { category: "Receipts", confidence: 0.95 },
  "netmeds.com": { category: "Receipts", confidence: 0.95 },
  "medlife.com": { category: "Receipts", confidence: 0.95 },

  // ─── Real estate ──────────────────────────────────────────────
  "nobroker.in": { category: "Promotions", confidence: 0.93 },
  "magicbricks.com": { category: "Promotions", confidence: 0.93 },
  "99acres.com": { category: "Promotions", confidence: 0.93 },
  "housing.com": { category: "Promotions", confidence: 0.93 },

  // ─── Wedding vendors (matrimony is a separate, Social bucket above) ──
  "wedmegood.com": { category: "Promotions", confidence: 0.9 },
  "weddingwire.in": { category: "Promotions", confidence: 0.9 },

  // ─── Gaming / fantasy sports ──────────────────────────────────
  // Payout confirmations ("You won ₹500, credited") are already caught by
  // isTransactionEmail's ₹/credited patterns before this domain lookup runs.
  "dream11.com": { category: "Promotions", confidence: 0.9 },
  "mpl.live": { category: "Promotions", confidence: 0.9 },
  "winzogames.com": { category: "Promotions", confidence: 0.9 },

  // ─── Parenting / baby e-commerce ──────────────────────────────
  "firstcry.com": { category: "Promotions", confidence: 0.93 },
  "babychakra.com": { category: "Promotions", confidence: 0.9 },
  "parentune.com": { category: "Promotions", confidence: 0.9 },

  // ─── Religious / spiritual ─────────────────────────────────────
  "isha.sadhguru.org": { category: "Newsletter", confidence: 0.9 },
  "artofliving.org": { category: "Newsletter", confidence: 0.9 },

  // ─── Misc ────────────────────────────────────────────────────
  "smt.plusoasis.com": { category: "Promotions", confidence: 0.85 },
  "novarace.in": { category: "Notifications", confidence: 0.85 },
  "match.indeed.com": { category: "Jobs & Careers", confidence: 0.95 },
};

// ─── Attachment-sensitive domains ───────────────────────────────
// These are deliberately NOT in KNOWN_DOMAINS. Each has a low-stakes
// default (used when there's no attachment) and escalates to a protected
// category when hasAttachment is true. The escalation target is
// vertical-specific — financial documents escalate to Finance, personal
// health records escalate to Personal. See classifyByRules() for how
// these are checked relative to the flat KNOWN_DOMAINS lookup — the
// escalation check MUST run before the flat lookup, and these domains
// must stay out of KNOWN_DOMAINS, or the attachment check silently never
// fires (this was the original bug: FINANCE_DOMAINS overlapped entries
// already in KNOWN_DOMAINS, so the flat lookup always won first).

// Banks / NBFCs / insurance / credit cards / BNPL — no attachment usually
// means an alert or marketing; an attachment usually means a real
// statement or policy document.
const BANK_ATTACHMENT_DOMAINS = [
  "hdfcbank.com",
  "hdfcbank.net",
  "icicibank.com",
  "axisbank.com",
  "sbi.co.in",
  "kotak.com",
  "yesbank.in",
  "indusind.com",
  "pnbindia.in",
  "unionbankofindia.co.in",
  "federalbank.co.in",
  "idfcfirstbank.com",
  "aubank.in",
  "hdfcbank.bank.in",
  "custcomm.icicibank.com",
  "communications.sbi.co.in",
  "miraeassetmf.co.in",
  "cred.club",
  "hdfccrediila.com",
  "sbicard.com",
  "icicicredit.com",
  "axiscard.in",
  "slice.is",
  "uni.club",
  "lazypaycredit.com",
  "simpl.credit",
  "welcome.americanexpress.com",
  "email.americanexpress.com",
  "hdfclife.com",
  "iciciprulife.com",
  "licindia.in",
  "starhealth.in",
  "online.hdfclife.com",
  "reminders.hdfclife.com",
  "em.kdp.com",
];

// Stock brokers — no attachment usually means market commentary or a
// portfolio ping (informational, safe to archive — Newsletter, not
// Finance); an attachment usually means a contract note or a tax/P&L
// statement (Finance, keep).
const BROKER_ATTACHMENT_DOMAINS = [
  "zerodha.com",
  "groww.in",
  "upstox.com",
  "angelone.in",
  "5paisa.com",
];

// Healthcare diagnostics/consultation — no attachment usually means an
// appointment reminder (routine); an attachment usually means a lab
// report, prescription, or discharge summary. These escalate to Personal,
// not Finance — they're irreplaceable personal records, not money
// documents.
const HEALTHCARE_ATTACHMENT_DOMAINS = ["practo.com", "apollo247.com"];

// ─── Helper functions ──────────────────────────────────────────

function isBankPromotional(subject) {
  if (!subject) return false
  const patterns = [
    /apply now/i,
    /discover more/i,
    /instant savings/i,
    /\bYONO\b/i,
    /need a loan/i,
    /get a loan/i,
    /apply for/i,
    /exclusive offer/i,
    /limited time/i,
    /special offer/i,
    /cashback offer/i,
    /reward points/i,
    /upgrade (your|to)/i,
    /download (our|the) app/i,
    /click here to/i,
    /pre.?approved/i,
    /you.re eligible/i,
    /check your eligibility/i,
    /fulfil your dream/i,
    /all in one/i,
    /save more/i,
    /earn more/i,
    /get up to/i,
    /interest rate/i,
    /zero fee/i,
    /no cost emi/i,
    /personal loan/i,
    /home loan/i,
    /credit card/i,
  ]
  return patterns.some(p => p.test(subject))
}

// Marketing/deal subjects from travel domains — runs before the flat
// domain lookup so a MakeMyTrip "Flat 40% off flights" email doesn't
// inherit the domain's default Travel (Keep) treatment. Genuine bookings
// are untouched since they don't match these patterns.
function isTravelPromotional(subject) {
  if (!subject) return false;
  const patterns = [
    /\d+%\s*off/i,
    /flat \d+% off/i,
    /flash sale/i,
    /book now and save/i,
    /limited (time|seats|period)/i,
    /sale on (flights|hotels|holidays)/i,
    /monsoon sale/i,
    /deal of the day/i,
    /discount code/i,
    /save up to/i,
    /exclusive deal/i,
    /best price guarantee/i,
    /don.t miss (this|out)/i,
  ];
  return patterns.some((p) => p.test(subject));
}

function extractDomain(fromHeader) {
  if (!fromHeader) return null;
  const match = fromHeader.match(/@([^>>\s]+)/);
  return match ? match[1].toLowerCase() : null;
}

function isOTPEmail(subject) {
  if (!subject) return false;
  const patterns = [
    /\botp\b/i,
    /one.time.password/i,
    /verification code/i,
    /your code is/i,
    /\d{4,8} is your/i,
    /use this code/i,
    /login code/i,
    /security code/i,
    /\d{6} is the otp/i,
    /otp for/i,
    /enter this code/i,
  ];
  return patterns.some((p) => p.test(subject));
}

function isTransactionEmail(subject) {
  if (!subject) return false;
  const patterns = [
    /debited/i,
    /credited/i,
    /transaction/i,
    /payment (confirmed|received|failed|successful)/i,
    /amount of (rs\.?|inr|₹)/i,
    /\bUPI\b/,
    /NEFT|RTGS|IMPS/i,
    /a\/c.*debited/i,
    /a\/c.*credited/i,
    /sent ₹/i,
    /received ₹/i,
    /paid ₹/i,
    /your (emi|bill|due) (of|for)/i,
    /minimum.*due/i,
    /payment due/i,
    /bill generated/i,
    /statement (is )?ready/i,
    /your.*statement/i,
    /was paid on amazon/i,
    /added to your amazon pay/i,
    /cashback of ₹/i,
    /reward points/i,
    /auto debit is active/i,
    /funds.*securities balance/i,
    /account summary as on/i,
    // Stock broker trade execution — day-to-day confirmations, not
    // statements. "Contract note" deliberately excluded — that's a real
    // document, usually attached, and belongs in Finance instead (see
    // BROKER_ATTACHMENT_DOMAINS). ".*" tolerates realistic phrasing like
    // "order for 10 shares of TCS was executed" rather than requiring the
    // words to sit adjacent. "buy/sell order" prefix (not bare "order")
    // avoids colliding with generic e-commerce "your order" subjects.
    /trade confirmation/i,
    /(buy|sell) order.*(executed|completed|placed)/i,
    /shares? (bought|sold|credited|debited)/i,
    /funds added to your (account|wallet)/i,
    /withdrawal (processed|successful)/i,
  ];
  return patterns.some((p) => p.test(subject));
}

function isReceiptEmail(subject) {
  if (!subject) return false;
  const patterns = [
    /your order/i,
    /order confirmed/i,
    /order #/i,
    /order id/i,
    /invoice/i,
    /receipt for/i,
    /your receipt/i,
    /booking confirmed/i,
    /reservation confirmed/i,
    /shipment/i,
    /dispatched/i,
    /out for delivery/i,
    /delivered/i,
    /^shipped:/i,
    /^ordered:/i,
    /^out for delivery:/i,
    /^delivered:/i,
    /your.*order for \d+ item/i,
    /your return of/i,
    /gift voucher/i,
  ];
  return patterns.some((p) => p.test(subject));
}

function isTravelEmail(subject) {
  if (!subject) return false;
  const patterns = [
    /flight/i,
    /boarding pass/i,
    /itinerary/i,
    /hotel booking/i,
    /train ticket/i,
    /\bpnr\b/i,
    /check.in/i,
    /e-ticket/i,
    /bus ticket/i,
    /cab booking/i,
  ];
  return patterns.some((p) => p.test(subject));
}

function isJobEmail(subject) {
  if (!subject) return false
  const patterns = [
    /job alert/i,
    /new jobs/i,
    /jobs matching/i,
    /\d+ new jobs/i,
    /jobs? for you/i,
    /recommended jobs/i,
    /job opening/i,
    /career opportunity/i,
  ]
  return patterns.some(p => p.test(subject))
}


function isFinanceEmail(subject) {
  if (!subject) return false;
  const patterns = [
    /account (update|summary|statement)/i,
    /auto debit/i,
    /base total expense ratio/i,
    /funds.*securities/i,
    /policy no\./i,
    /mutual fund/i,
    /portfolio/i,
    /investment/i,
    /your.*statement/i,
    /closing bell/i,
    /market (update|wrap|recap)/i,
    /m-?cap/i,
  ];
  return patterns.some((p) => p.test(subject));
}

function isWorkEmail(subject) {
  if (!subject) return false
  const patterns = [
    /urgent requirement/i,
    /requirement for the role/i,
    /hiring for/i,
    /we.re hiring/i,
    /open position/i,
    /your (cv|resume|profile)/i,
    /interview (scheduled|invite|call)/i,
  ]
  return patterns.some(p => p.test(subject))
}

// ─── Main classification function ─────────────────────────────
//
// Single priority chain — no duplicate blocks. Order matters:
//  1. OTP always wins.
//  2. Promotional-subject overrides run before any domain-based default,
//     so e.g. a bank/travel marketing email doesn't inherit its domain's
//     "important" default category.
//  3. Transaction and receipt subject patterns also run before the flat
//     domain lookup, for the same reason — an e-commerce domain's
//     Promotions default shouldn't swallow a genuine "order shipped" email.
//  4. Attachment-based escalation for verticals where an attachment
//     changes what the email actually is (bank/broker statement vs
//     marketing; lab report vs appointment reminder).
//  5. Flat known-domain lookup.
//  6. No-attachment fallback defaults for the attachment-sensitive domains.
//  7. Generic subject-pattern fallbacks for anything with no domain match.

export function classifyByRules(email) {
  const { from, subject, headers, hasAttachment } = email;
  const domain = extractDomain(from);

  // Priority 1: OTP — always highest priority
  if (isOTPEmail(subject)) {
    return { category: "OTP & Security", confidence: 0.97, reason: "OTP pattern in subject" };
  }

  // Priority 2: Promotional-subject overrides — before any domain default
  if (isBankPromotional(subject)) {
    return { category: "Promotions", confidence: 0.88, reason: "Promotional pattern in subject from bank sender" };
  }
  if (isTravelPromotional(subject)) {
    return { category: "Promotions", confidence: 0.88, reason: "Discount/deal pattern in subject" };
  }

  // Priority 3: Attachment-based escalation — runs BEFORE transaction/
  // receipt subject patterns. Otherwise a genuine bank statement PDF
  // (subject: "Your monthly account statement") gets caught by
  // isTransactionEmail's /your.*statement/i pattern and lands in
  // Transactions instead of the protected Finance tier — exactly the
  // scenario this whole mechanism exists to get right.
  if (hasAttachment && domain && (BANK_ATTACHMENT_DOMAINS.includes(domain) || BROKER_ATTACHMENT_DOMAINS.includes(domain))) {
    return { category: "Finance", confidence: 0.97, reason: "Finance/broker sender with attachment — likely statement or document" };
  }
  if (hasAttachment && domain && HEALTHCARE_ATTACHMENT_DOMAINS.includes(domain)) {
    return { category: "Personal", confidence: 0.95, reason: "Healthcare sender with attachment — likely lab report or prescription" };
  }
  if (hasAttachment && isFinanceEmail(subject)) {
    return { category: "Finance", confidence: 0.93, reason: "Finance subject with attachment" };
  }

  // Priority 4: Transaction patterns (money movement, trade execution)
  if (isTransactionEmail(subject)) {
    return { category: "Transactions", confidence: 0.93, reason: "Transaction pattern in subject" };
  }

  // Priority 5: Receipt patterns — must run before the flat domain lookup,
  // so e.g. a Myntra "order shipped" email isn't stuck at Myntra's
  // Promotions default (the same class of bug isBankPromotional fixes,
  // just in the opposite direction).
  if (isReceiptEmail(subject)) {
    return { category: "Receipts", confidence: 0.88, reason: "Receipt pattern in subject" };
  }

  // Priority 6: Known sender domain — flat lookup
  if (domain && KNOWN_DOMAINS[domain]) {
    return { ...KNOWN_DOMAINS[domain], reason: `Known domain: ${domain}` };
  }

  // Priority 7: No-attachment defaults for attachment-sensitive domains
  if (domain && BANK_ATTACHMENT_DOMAINS.includes(domain)) {
    return { category: "Notifications", confidence: 0.85, reason: "Bank/finance sender, no attachment — likely alert or marketing" };
  }
  if (domain && BROKER_ATTACHMENT_DOMAINS.includes(domain)) {
    return { category: "Newsletter", confidence: 0.85, reason: "Broker sender, no attachment — likely market update or portfolio ping" };
  }
  if (domain && HEALTHCARE_ATTACHMENT_DOMAINS.includes(domain)) {
    return { category: "Notifications", confidence: 0.85, reason: "Healthcare sender, no attachment — likely appointment reminder" };
  }

  // Priority 8: Bulk email headers
  if (headers?.["list-unsubscribe"]) {
    if (headers?.["precedence"] === "bulk") {
      return { category: "Newsletter", confidence: 0.9, reason: "List-Unsubscribe + Precedence: bulk" };
    }
    return { category: "Promotions", confidence: 0.82, reason: "List-Unsubscribe header present" };
  }

  // Priority 9: Finance patterns (no attachment)
  if (isFinanceEmail(subject)) {
    return { category: "Finance", confidence: 0.88, reason: "Finance pattern in subject" };
  }

  // Priority 10: Travel patterns
  if (isTravelEmail(subject)) {
    return { category: "Travel", confidence: 0.88, reason: "Travel pattern in subject" };
  }

  // Priority 11: Job portal patterns (naukri, indeed style alerts)
  if (isJobEmail(subject)) {
    return { category: "Jobs & Careers", confidence: 0.85, reason: "Job alert pattern in subject" };
  }

  // Priority 12: Recruiter / work opportunity patterns
  if (isWorkEmail(subject)) {
    return { category: "Jobs & Careers", confidence: 0.87, reason: "Recruiter pattern in subject" };
  }

  // Priority 13: Precedence header alone
  if (headers?.["precedence"] === "bulk") {
    return { category: "Promotions", confidence: 0.85, reason: "Precedence: bulk header" };
  }

  return null;
}
