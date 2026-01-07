# Complete Secret Setup for Firebase App Hosting
# Run these commands to ensure all secrets are created and have proper permissions

# ==============================================================================
# PART 1: Create ALL Secrets (if not already created)
# ==============================================================================

# Core Configuration
echo -n "production" | gcloud secrets create NODE_ENV --data-file=- --replication-policy="automatic"
echo -n "8080" | gcloud secrets create PORT --data-file=- --replication-policy="automatic"

# MongoDB
echo -n "YOUR_MONGODB_URI" | gcloud secrets create MONGODB_URI --data-file=- --replication-policy="automatic"

# JWT
echo -n "YOUR_JWT_SECRET" | gcloud secrets create JWT_SECRET --data-file=- --replication-policy="automatic"

# R2 Configuration
echo -n "YOUR_R2_ACCOUNT_ID" | gcloud secrets create R2_ACCOUNT_ID --data-file=- --replication-policy="automatic"
echo -n "YOUR_R2_ACCESS_KEY_ID" | gcloud secrets create R2_ACCESS_KEY_ID --data-file=- --replication-policy="automatic"
echo -n "YOUR_R2_SECRET_ACCESS_KEY" | gcloud secrets create R2_SECRET_ACCESS_KEY --data-file=- --replication-policy="automatic"
echo -n "av-utility-media" | gcloud secrets create R2_BUCKET_NAME --data-file=- --replication-policy="automatic"
echo -n "auto" | gcloud secrets create R2_REGION --data-file=- --replication-policy="automatic"
echo -n "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com" | gcloud secrets create R2_ENDPOINT --data-file=- --replication-policy="automatic"

# Job Configuration
echo -n "2" | gcloud secrets create MAX_CONCURRENT_JOBS --data-file=- --replication-policy="automatic"
echo -n "30" | gcloud secrets create JOB_TIMEOUT_MINUTES --data-file=- --replication-policy="automatic"
echo -n "300000" | gcloud secrets create CLEANUP_INTERVAL_MS --data-file=- --replication-policy="automatic"
echo -n "86400000" | gcloud secrets create JOB_RETENTION_MS --data-file=- --replication-policy="automatic"
echo -n "300" | gcloud secrets create SIGNED_URL_EXPIRY --data-file=- --replication-policy="automatic"

# VAPID Keys
echo -n "YOUR_VAPID_PUBLIC_KEY" | gcloud secrets create VAPID_PUBLIC_KEY --data-file=- --replication-policy="automatic"
echo -n "YOUR_VAPID_PRIVATE_KEY" | gcloud secrets create VAPID_PRIVATE_KEY --data-file=- --replication-policy="automatic"
echo -n "mailto:YOUR_EMAIL" | gcloud secrets create VAPID_SUBJECT --data-file=- --replication-policy="automatic"

# CORS
echo -n "http://localhost:5173,https://your-frontend.web.app" | gcloud secrets create ALLOWED_ORIGINS --data-file=- --replication-policy="automatic"

# ==============================================================================
# PART 2: Get Project Number
# ==============================================================================

PROJECT_NUMBER=$(gcloud projects describe av-utility --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"

# ==============================================================================
# PART 3: Grant Permissions to ALL Secrets
# ==============================================================================

# List of all secrets
SECRETS=(
    "NODE_ENV"
    "PORT"
    "MONGODB_URI"
    "JWT_SECRET"
    "R2_ACCOUNT_ID"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    "R2_BUCKET_NAME"
    "R2_REGION"
    "R2_ENDPOINT"
    "MAX_CONCURRENT_JOBS"
    "JOB_TIMEOUT_MINUTES"
    "CLEANUP_INTERVAL_MS"
    "JOB_RETENTION_MS"
    "SIGNED_URL_EXPIRY"
    "VAPID_PUBLIC_KEY"
    "VAPID_PRIVATE_KEY"
    "VAPID_SUBJECT"
    "ALLOWED_ORIGINS"
)

# Grant permissions to App Hosting Service Account
for SECRET in "${SECRETS[@]}"; do
    echo "Granting access to $SECRET for App Hosting..."
    gcloud secrets add-iam-policy-binding "$SECRET" \
        --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebaseapphosting.iam.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor"
done

# Grant permissions to Cloud Build Service Account
for SECRET in "${SECRETS[@]}"; do
    echo "Granting access to $SECRET for Cloud Build..."
    gcloud secrets add-iam-policy-binding "$SECRET" \
        --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor"
done

echo "✅ All secrets configured and permissions granted!"
echo "You can now deploy with: firebase deploy --only apphosting:avutility"
