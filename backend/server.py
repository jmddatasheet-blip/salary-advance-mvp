from fastapi import FastAPI, APIRouter, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta, timezone
import base64


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Demo user (no auth in MVP) - used for customer salary advance flows
DEMO_USER_ID = "demo-user-1"

# Admin credentials (for simple MVP login, loaded from environment)
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ----------------------
# Health / status models
# ----------------------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()

    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    return [StatusCheck(**check) for check in status_checks]


# ----------------------
# Salary advance models
# ----------------------
class TimelineEvent(BaseModel):
    step: str
    status: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    meta: Optional[Dict] = None


class KycInfo(BaseModel):
    pan: Optional[str] = None
    pan_verified: bool = False
    aadhaar: Optional[str] = None
    aadhaar_verified: bool = False
    selfie_captured: bool = False
    face_match_score: Optional[float] = None
    face_match_passed: bool = False


class IncomeInfo(BaseModel):
    employer_name: Optional[str] = None
    avg_net_salary: Optional[float] = None
    salary_credit_dates: List[str] = Field(default_factory=list)
    stability_score: Optional[float] = None


class RiskInfo(BaseModel):
    bureau_score: Optional[int] = None
    risk_category: Optional[str] = None  # LOW / MEDIUM / HIGH


class OfferInfo(BaseModel):
    amount: Optional[float] = None
    processing_fee: Optional[float] = None
    interest_rate_annual: Optional[float] = None
    repayment_date: Optional[datetime] = None


class ConsentInfo(BaseModel):
    accepted: bool = False
    accepted_at: Optional[datetime] = None
    language: Optional[str] = None  # e.g. "en", "hi" or "en+hi"


class VideoKycInfo(BaseModel):
    status: str = "pending"  # pending / completed
    completed_at: Optional[datetime] = None


class DisbursementInfo(BaseModel):
    status: str = "pending"  # pending / done
    amount: Optional[float] = None
    reference_id: Optional[str] = None
    disbursed_at: Optional[datetime] = None


class RepaymentInfo(BaseModel):
    status: str = "pending"  # pending / due / paid / overdue
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    late_fee: float = 0.0


class CollectionInfo(BaseModel):
    status: str = "none"  # none / soft_reminder / calling / escalated / settled
    notes: List[str] = Field(default_factory=list)


class SalaryAdvanceApplication(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    applicant_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    current_stage: str = "apply"  # apply / kyc / income_check / risk_scoring / offer / consent / video_kyc / disbursement / repayment / closed / rejected

    kyc: KycInfo = Field(default_factory=KycInfo)
    income: IncomeInfo = Field(default_factory=IncomeInfo)
    risk: RiskInfo = Field(default_factory=RiskInfo)
    offer: OfferInfo = Field(default_factory=OfferInfo)
    consent: ConsentInfo = Field(default_factory=ConsentInfo)
    video_kyc: VideoKycInfo = Field(default_factory=VideoKycInfo)
    disbursement: DisbursementInfo = Field(default_factory=DisbursementInfo)


class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_code: str
    name: str
    department: str
    post: str
    email: Optional[str] = None
    phone: Optional[str] = None
    salary: Optional[float] = None
    joining_date: Optional[str] = None  # keep as string for simplicity
    resignation_date: Optional[str] = None
    last_working_date: Optional[str] = None
    address: Optional[str] = None
    status: str = "active"  # active / abscond / resigned / terminated / death
    photo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ----------------------
# Salary advance helpers
# ----------------------
async def _get_current_application() -> Optional[SalaryAdvanceApplication]:
    doc = await db.salary_advance_applications.find_one(
        {"user_id": DEMO_USER_ID},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not doc:
        return None
    return SalaryAdvanceApplication(**doc)


async def _get_application_by_id(app_id: str) -> SalaryAdvanceApplication:
    doc = await db.salary_advance_applications.find_one({"id": app_id}, {"_id": 0})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    return SalaryAdvanceApplication(**doc)


async def _save_application(app: SalaryAdvanceApplication) -> SalaryAdvanceApplication:
    await db.salary_advance_applications.replace_one({"id": app.id}, app.model_dump(), upsert=True)
    return app


def _add_timeline_event(app: SalaryAdvanceApplication, step: str, status_text: str, meta: Optional[Dict] = None) -> None:
    app.timeline.append(
        TimelineEvent(
            step=step,
            status=status_text,
            meta=meta or {},
        )
    )


# ----------------------
# Admin models & endpoints
# ----------------------


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginResponse(BaseModel):
    success: bool
    message: str


@api_router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(body: AdminLoginRequest):
    """Very simple admin login for MVP using env-based credentials."""
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin credentials not configured",
        )

    if body.email == ADMIN_EMAIL and body.password == ADMIN_PASSWORD:
        return AdminLoginResponse(success=True, message="Admin login successful")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid admin credentials",
    )


class EmployeeCreateRequest(BaseModel):
    name: str
    department: str
    post: str
    email: Optional[str] = None
    phone: Optional[str] = None
    salary: Optional[float] = None
    joining_date: Optional[str] = None
    resignation_date: Optional[str] = None
    last_working_date: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    photo_url: Optional[str] = None


class EmployeeListResponse(BaseModel):
    employees: List[Employee]


@api_router.post("/admin/employees", response_model=Employee)
async def create_employee(body: EmployeeCreateRequest):
    """Add a new employee (admin-only, simple MVP without full auth)."""
    data = body.model_dump()
    # default status if not provided
    if not data.get("status"):
        data["status"] = "active"
    employee = Employee(**data)
    await db.employees.insert_one(employee.model_dump())
    return employee


@api_router.get("/admin/employees", response_model=EmployeeListResponse)
async def list_employees():
    """List all employees for admin view."""
    docs = await db.employees.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    employees = [Employee(**doc) for doc in docs]
    return EmployeeListResponse(employees=employees)


class AdminApplicationsResponse(BaseModel):
    applications: List[SalaryAdvanceApplication]


@api_router.get("/admin/applications", response_model=AdminApplicationsResponse)
async def list_applications_for_admin():
    """List all salary advance applications for admin view."""
    docs = await db.salary_advance_applications.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    apps = [SalaryAdvanceApplication(**doc) for doc in docs]
    return AdminApplicationsResponse(applications=apps)


# ----------------------
# Salary advance endpoints
# ----------------------
class ApplicationCreateInput(BaseModel):
    applicant_name: Optional[str] = None


@api_router.post("/salary-advance/applications", response_model=SalaryAdvanceApplication)
async def create_salary_advance_application(body: ApplicationCreateInput):
    """Start a new salary advance application for the demo user."""

    app_obj = SalaryAdvanceApplication(
        user_id=DEMO_USER_ID,
        applicant_name=body.applicant_name,
    )
    _add_timeline_event(app_obj, "Apply", "Application started")

    await db.salary_advance_applications.insert_one(app_obj.model_dump())
    return app_obj


@api_router.get("/salary-advance/applications/current", response_model=SalaryAdvanceApplication)
async def get_current_salary_advance_application():
    app_obj = await _get_current_application()
    if not app_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No application found")
    return app_obj


class KycSubmitInput(BaseModel):
    app_id: str
    pan: str
    aadhaar: str
    selfie_url: Optional[str] = None


@api_router.post("/salary-advance/kyc/submit", response_model=SalaryAdvanceApplication)
async def submit_kyc(body: KycSubmitInput):
    """Submit PAN, Aadhaar and selfie info. Verification is simulated for MVP."""

    app_obj = await _get_application_by_id(body.app_id)

    # Basic PAN validation: 10 characters
    if len(body.pan.strip()) != 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid PAN format")

    # Basic Aadhaar validation: 12 digits
    if not (body.aadhaar.isdigit() and len(body.aadhaar) == 12):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Aadhaar format")

    app_obj.kyc.pan = body.pan.upper()
    app_obj.kyc.pan_verified = True
    app_obj.kyc.aadhaar = body.aadhaar
    app_obj.kyc.aadhaar_verified = True
    app_obj.kyc.selfie_captured = body.selfie_url is not None

    # Simulated face match
    app_obj.kyc.face_match_score = 0.92
    app_obj.kyc.face_match_passed = True

    app_obj.current_stage = "income_check"

    _add_timeline_event(
        app_obj,
        "KYC",
        "PAN & Aadhaar verified, selfie and face match completed (simulated)",
    )

    return await _save_application(app_obj)


class IncomeSubmitInput(BaseModel):
    app_id: str
    employer_name: str
    avg_net_salary: float
    salary_credit_dates: List[str]


@api_router.post("/salary-advance/income/submit", response_model=SalaryAdvanceApplication)
async def submit_income(body: IncomeSubmitInput):
    """Submit employer and salary details. Stability is simulated based on provided months."""

    if body.avg_net_salary <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Average salary must be positive")

    app_obj = await _get_application_by_id(body.app_id)

    app_obj.income.employer_name = body.employer_name
    app_obj.income.avg_net_salary = body.avg_net_salary
    app_obj.income.salary_credit_dates = body.salary_credit_dates

    # Very simple stability score: months * 10, capped at 100
    months = len(body.salary_credit_dates)
    app_obj.income.stability_score = float(min(months * 10, 100))

    app_obj.current_stage = "risk_scoring"

    _add_timeline_event(
        app_obj,
        "Income Check",
        "Employer and salary details submitted, stability evaluated (simulated)",
    )

    return await _save_application(app_obj)


class RiskScoreInput(BaseModel):
    app_id: str


@api_router.post("/salary-advance/risk/score", response_model=SalaryAdvanceApplication)
async def score_risk(body: RiskScoreInput):
    """Simulate bureau pull and internal risk rules to prepare for offer."""

    app_obj = await _get_application_by_id(body.app_id)

    if not app_obj.income.avg_net_salary:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Income details missing")

    avg_salary = app_obj.income.avg_net_salary

    # Simulated bureau score based on salary & stability
    if avg_salary >= 50000:
        bureau_score = 780
    elif avg_salary >= 30000:
        bureau_score = 730
    else:
        bureau_score = 680

    app_obj.risk.bureau_score = bureau_score

    if bureau_score >= 750:
        risk_category = "LOW"
    elif bureau_score >= 700:
        risk_category = "MEDIUM"
    else:
        risk_category = "HIGH"

    app_obj.risk.risk_category = risk_category

    app_obj.current_stage = "offer"

    _add_timeline_event(
        app_obj,
        "Risk Scoring",
        f"Bureau score {bureau_score}, risk category {risk_category} (simulated)",
    )

    return await _save_application(app_obj)


class OfferGenerateInput(BaseModel):
    app_id: str


@api_router.post("/salary-advance/offer/generate", response_model=SalaryAdvanceApplication)
async def generate_offer(body: OfferGenerateInput):
    """Generate a salary advance offer based on income and risk profile."""

    app_obj = await _get_application_by_id(body.app_id)

    if not app_obj.income.avg_net_salary or not app_obj.risk.risk_category:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Income or risk information missing")

    avg_salary = app_obj.income.avg_net_salary

    # Simple rule: multiplier depends on risk
    if app_obj.risk.risk_category == "LOW":
        multiplier = 0.6
    elif app_obj.risk.risk_category == "MEDIUM":
        multiplier = 0.4
    else:
        multiplier = 0.25

    max_amount = round(avg_salary * multiplier, 2)

    processing_fee_rate = 0.02  # 2%
    interest_rate_annual = 24.0  # 24% p.a.

    processing_fee = round(max_amount * processing_fee_rate, 2)

    # Repayment date: 30 days from now (approx next salary date)
    repayment_date = datetime.now(timezone.utc) + timedelta(days=30)

    app_obj.offer.amount = max_amount
    app_obj.offer.processing_fee = processing_fee
    app_obj.offer.interest_rate_annual = interest_rate_annual
    app_obj.offer.repayment_date = repayment_date

    _add_timeline_event(
        app_obj,
        "Offer",
        "Salary advance offer generated",
        meta={
            "amount": max_amount,
            "processing_fee": processing_fee,
            "interest_rate_annual": interest_rate_annual,
            "repayment_date": repayment_date.isoformat(),
        },
    )

    return await _save_application(app_obj)


class OfferAcceptInput(BaseModel):
    app_id: str
    language: str = "en+hi"  # Both Hindi and English declaration


@api_router.post("/salary-advance/offer/accept", response_model=SalaryAdvanceApplication)
async def accept_offer(body: OfferAcceptInput):
    """Customer accepts the offer and declarations."""

    app_obj = await _get_application_by_id(body.app_id)

    if not app_obj.offer.amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Offer not generated yet")

    app_obj.consent.accepted = True
    app_obj.consent.accepted_at = datetime.now(timezone.utc)
    app_obj.consent.language = body.language

    app_obj.current_stage = "consent"

    _add_timeline_event(
        app_obj,
        "Consent",
        "Customer accepted offer and declarations",
        meta={"language": body.language},
    )

    return await _save_application(app_obj)


class VideoKycCompleteInput(BaseModel):
    app_id: str


@api_router.post("/salary-advance/video-kyc/complete", response_model=SalaryAdvanceApplication)
async def complete_video_kyc(body: VideoKycCompleteInput):
    """Mark video KYC as completed (simulated)."""

    app_obj = await _get_application_by_id(body.app_id)

    app_obj.video_kyc.status = "completed"
    app_obj.video_kyc.completed_at = datetime.now(timezone.utc)

    app_obj.current_stage = "video_kyc"

    _add_timeline_event(
        app_obj,
        "Video KYC",
        "Video KYC marked as completed (simulated)",
    )

    return await _save_application(app_obj)


class DisbursementInput(BaseModel):
    app_id: str


@api_router.post("/salary-advance/disbursement", response_model=SalaryAdvanceApplication)
async def disburse_salary_advance(body: DisbursementInput):
    """Simulate instant disbursement via NEFT/IMPS/UPI."""

    app_obj = await _get_application_by_id(body.app_id)

    if not app_obj.offer.amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Offer not generated")

    if not app_obj.consent.accepted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Offer not accepted")

    disbursed_at = datetime.now(timezone.utc)

    app_obj.disbursement.status = "done"
    app_obj.disbursement.amount = app_obj.offer.amount
    app_obj.disbursement.reference_id = f"NEFT-{uuid.uuid4().hex[:10].upper()}"
    app_obj.disbursement.disbursed_at = disbursed_at

    # After disbursement, repayment becomes due
    app_obj.repayment.status = "due"
    app_obj.repayment.due_date = app_obj.offer.repayment_date

    app_obj.current_stage = "repayment"

    _add_timeline_event(
        app_obj,
        "Disbursement",
        "Amount disbursed to customer (simulated)",
        meta={
            "amount": app_obj.disbursement.amount,
            "reference_id": app_obj.disbursement.reference_id,
            "disbursed_at": disbursed_at.isoformat(),
        },
    )

    return await _save_application(app_obj)


class RepaymentRecordInput(BaseModel):
    app_id: str
    late_fee: float = 0.0


@api_router.post("/salary-advance/repayment/record", response_model=SalaryAdvanceApplication)
async def record_repayment(body: RepaymentRecordInput):
    """Record loan repayment and close the salary advance."""

    app_obj = await _get_application_by_id(body.app_id)

    if app_obj.repayment.status not in {"due", "overdue"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Repayment is not due")

    paid_at = datetime.now(timezone.utc)

    app_obj.repayment.status = "paid"
    app_obj.repayment.paid_date = paid_at
    app_obj.repayment.late_fee = body.late_fee

    app_obj.collection.status = "settled" if body.late_fee > 0 else "none"

    app_obj.current_stage = "closed"

    _add_timeline_event(
        app_obj,
        "Repayment",
        "Repayment recorded and loan closed",
        meta={"late_fee": body.late_fee, "paid_at": paid_at.isoformat()},
    )

    return await _save_application(app_obj)


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
