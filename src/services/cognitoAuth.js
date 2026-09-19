/**
 * InterviewMitra Pro - AWS Cognito Auth Service
 * Uses standard browser fetch to communicate directly with AWS Cognito User Pool.
 * User Pool ID: ap-south-1_8URSu27hN
 * Client ID: 5j3l3ppe9s8luomu3gqveorjm8
 */

const COGNITO_ENDPOINT = 'https://cognito-idp.ap-south-1.amazonaws.com/';
const CLIENT_ID = '5j3l3ppe9s8luomu3gqveorjm8';
const AUTH_STORAGE_KEY = 'interviewmitra_cognito_auth';

// Demo credentials for quick 1-click evaluation
export const DEMO_USER = {
  email: 'testuser@example.com',
  password: 'TestPass123!'
};

/**
 * Perform Cognito InitiateAuth with USER_PASSWORD_AUTH
 */
export async function loginWithCognito(email, password) {
  try {
    const response = await fetch(COGNITO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email.trim(),
          PASSWORD: password
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data.message || data.__type || 'Cognito authentication failed.';
      throw new Error(msg);
    }

    const authResult = data.AuthenticationResult;
    if (!authResult || !authResult.IdToken) {
      throw new Error('Cognito response did not return an IdToken.');
    }

    const sessionData = {
      email: email.trim(),
      idToken: authResult.IdToken,
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken,
      expiresAt: Date.now() + (authResult.ExpiresIn || 3600) * 1000
    };

    setStoredAuth(sessionData);
    return { success: true, session: sessionData };
  } catch (error) {
    console.error('Cognito login error:', error);
    throw error;
  }
}

/**
 * Perform Cognito SignUp for a new candidate
 */
export async function signUpWithCognito(email, password) {
  try {
    const response = await fetch(COGNITO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp'
      },
      body: JSON.stringify({
        ClientId: CLIENT_ID,
        Username: email.trim(),
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email.trim() }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data.message || data.__type || 'Cognito user registration failed.';
      throw new Error(msg);
    }

    return {
      success: true,
      userSub: data.UserSub,
      userConfirmed: data.UserConfirmed,
      message: 'User registered successfully. You can now log in.'
    };
  } catch (error) {
    console.error('Cognito signup error:', error);
    throw error;
  }
}

/**
 * Store Cognito Auth state in localStorage
 */
export function setStoredAuth(authData) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
  } catch (e) {
    console.warn('Could not save auth session to localStorage:', e);
  }
}

/**
 * Get stored Cognito Auth state from localStorage
 */
export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw);
    // Check if token is expired
    if (auth.expiresAt && Date.now() > auth.expiresAt) {
      clearStoredAuth();
      return null;
    }
    return auth;
  } catch (e) {
    return null;
  }
}

/**
 * Clear stored auth (Log out)
 */
export function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {}
}
