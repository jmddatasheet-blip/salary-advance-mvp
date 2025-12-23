#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class SalaryAdvanceAPITester:
    def __init__(self, base_url="https://rupey-access.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.current_app_id = None
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            else:
                self.log_test(name, False, f"Unsupported method: {method}")
                return False, {}

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            if success:
                self.log_test(name, True)
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}. Response: {response.text[:200]}")

            return success, response_data

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic API health"""
        return self.run_test("API Health Check", "GET", "", 200)

    def test_create_application(self):
        """Test creating a new salary advance application"""
        success, response = self.run_test(
            "Create Salary Advance Application",
            "POST",
            "salary-advance/applications",
            200,
            data={"applicant_name": "Test User"}
        )
        
        if success and response.get('id'):
            self.current_app_id = response['id']
            print(f"   📝 Application ID: {self.current_app_id}")
            
        return success, response

    def test_get_current_application(self):
        """Test getting current application"""
        return self.run_test(
            "Get Current Application",
            "GET",
            "salary-advance/applications/current",
            200
        )

    def test_submit_kyc(self):
        """Test KYC submission"""
        if not self.current_app_id:
            self.log_test("Submit KYC", False, "No application ID available")
            return False, {}
            
        return self.run_test(
            "Submit KYC",
            "POST",
            "salary-advance/kyc/submit",
            200,
            data={
                "app_id": self.current_app_id,
                "pan": "ABCDE1234F",
                "aadhaar": "123456789012",
                "selfie_url": "https://example.com/selfie.jpg"
            }
        )

    def test_submit_income(self):
        """Test income submission"""
        if not self.current_app_id:
            self.log_test("Submit Income", False, "No application ID available")
            return False, {}
            
        return self.run_test(
            "Submit Income",
            "POST",
            "salary-advance/income/submit",
            200,
            data={
                "app_id": self.current_app_id,
                "employer_name": "Test Corp Pvt Ltd",
                "avg_net_salary": 50000.0,
                "salary_credit_dates": ["1st Jan 2024", "1st Feb 2024", "1st Mar 2024", "1st Apr 2024"]
            }
        )

    def test_risk_scoring(self):
        """Test risk scoring"""
        if not self.current_app_id:
            self.log_test("Risk Scoring", False, "No application ID available")
            return False, {}
            
        return self.run_test(
            "Risk Scoring",
            "POST",
            "salary-advance/risk/score",
            200,
            data={"app_id": self.current_app_id}
        )

    def test_generate_offer(self):
        """Test offer generation"""
        if not self.current_app_id:
            self.log_test("Generate Offer", False, "No application ID available")
            return False, {}
            
        success, response = self.run_test(
            "Generate Offer",
            "POST",
            "salary-advance/offer/generate",
            200,
            data={"app_id": self.current_app_id}
        )
        
        if success and response.get('offer'):
            offer = response['offer']
            print(f"   💰 Offer Amount: ₹{offer.get('amount', 'N/A')}")
            print(f"   💳 Processing Fee: ₹{offer.get('processing_fee', 'N/A')}")
            print(f"   📈 Interest Rate: {offer.get('interest_rate_annual', 'N/A')}% p.a.")
            
        return success, response

    def test_accept_offer(self):
        """Test offer acceptance"""
        if not self.current_app_id:
            self.log_test("Accept Offer", False, "No application ID available")
            return False, {}
            
        return self.run_test(
            "Accept Offer",
            "POST",
            "salary-advance/offer/accept",
            200,
            data={
                "app_id": self.current_app_id,
                "language": "en+hi"
            }
        )

    def test_complete_video_kyc(self):
        """Test video KYC completion"""
        if not self.current_app_id:
            self.log_test("Complete Video KYC", False, "No application ID available")
            return False, {}
            
        return self.run_test(
            "Complete Video KYC",
            "POST",
            "salary-advance/video-kyc/complete",
            200,
            data={"app_id": self.current_app_id}
        )

    def test_disbursement(self):
        """Test disbursement"""
        if not self.current_app_id:
            self.log_test("Disbursement", False, "No application ID available")
            return False, {}
            
        success, response = self.run_test(
            "Disbursement",
            "POST",
            "salary-advance/disbursement",
            200,
            data={"app_id": self.current_app_id}
        )
        
        if success and response.get('disbursement'):
            disbursement = response['disbursement']
            print(f"   💸 Disbursed Amount: ₹{disbursement.get('amount', 'N/A')}")
            print(f"   🔗 Reference ID: {disbursement.get('reference_id', 'N/A')}")
            
        return success, response

    def test_record_repayment(self):
        """Test repayment recording"""
        if not self.current_app_id:
            self.log_test("Record Repayment", False, "No application ID available")
            return False, {}
            
        return self.run_test(
            "Record Repayment",
            "POST",
            "salary-advance/repayment/record",
            200,
            data={
                "app_id": self.current_app_id,
                "late_fee": 0.0
            }
        )

    def test_invalid_kyc_formats(self):
        """Test KYC validation with invalid formats"""
        if not self.current_app_id:
            self.log_test("Invalid KYC Formats", False, "No application ID available")
            return False, {}
        
        # Test invalid PAN (not 10 characters)
        success1, _ = self.run_test(
            "Invalid PAN Format",
            "POST",
            "salary-advance/kyc/submit",
            400,  # Expecting 400 Bad Request
            data={
                "app_id": self.current_app_id,
                "pan": "INVALID",
                "aadhaar": "123456789012"
            }
        )
        
        # Test invalid Aadhaar (not 12 digits)
        success2, _ = self.run_test(
            "Invalid Aadhaar Format",
            "POST",
            "salary-advance/kyc/submit",
            400,  # Expecting 400 Bad Request
            data={
                "app_id": self.current_app_id,
                "pan": "ABCDE1234F",
                "aadhaar": "invalid"
            }
        )
        
        return success1 and success2

    def run_full_flow_test(self):
        """Run complete salary advance flow test"""
        print("🚀 Starting Salary Advance API Full Flow Test")
        print("=" * 60)
        
        # Test basic health
        self.test_health_check()
        
        # Test full application flow
        self.test_create_application()
        self.test_get_current_application()
        self.test_submit_kyc()
        self.test_submit_income()
        self.test_risk_scoring()
        self.test_generate_offer()
        self.test_accept_offer()
        self.test_complete_video_kyc()
        self.test_disbursement()
        self.test_record_repayment()
        
        # Test validation
        # Note: We need a new application for validation tests since the previous one is closed
        print("\n🔍 Testing Validation Logic")
        self.test_create_application()  # Create new app for validation tests
        self.test_invalid_kyc_formats()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check details above.")
            return 1

def main():
    tester = SalaryAdvanceAPITester()
    return tester.run_full_flow_test()

if __name__ == "__main__":
    sys.exit(main())