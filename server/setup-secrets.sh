# GCP Secret Manager Setup Script
# Run these commands to create all secrets needed for Firebase App Hosting

# ==============================================================================
# STEP 1: Create Secrets in GCP Secret Manager
# ==============================================================================

echo "Creating secrets in GCP Secret Manager..."

# MongoDB URI
echo -n "YOUR_MONGODB_URI_HERE" | gcloud secrets create MONGODB_URI \
    --data-file=- \
    --replication-policy="automatic"

# JWT Secret
echo -n "YOUR_JWT_SECRET_HERE" | gcloud secrets create JWT_SECRET \
    --data-file=- \
    --replication-policy="automatic"

# R2 Access Key ID
echo -n "YOUR_R2_ACCESS_KEY_ID_HERE" | gcloud secrets create R2_ACCESS_KEY_ID \
    --data-file=- \
    --replication-policy="automatic"

# R2 Secret Access Key
echo -n "YOUR_R2_SECRET_ACCESS_KEY_HERE" | gcloud secrets create R2_SECRET_ACCESS_KEY \
    --data-file=- \
    --replication-policy="automatic"

# VAPID Private Key
echo -n "YOUR_VAPID_PRIVATE_KEY_HERE" | gcloud secrets create VAPID_PRIVATE_KEY \
    --data-file=- \
    --replication-policy="automatic"

echo "✅ All secrets created!"

# ==============================================================================
# STEP 2: Get Your Project Number
# ==============================================================================

echo ""
echo "Getting project number..."
PROJECT_NUMBER=$(gcloud projects describe av-utility --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"

# ==============================================================================
# STEP 3: Grant Access to Firebase App Hosting Service Account
# ==============================================================================

echo ""
echo "Granting access to App Hosting service account..."

# MONGODB_URI
gcloud secrets add-iam-policy-binding MONGODB_URI \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebaseapphosting.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# JWT_SECRET
gcloud secrets add-iam-policy-binding JWT_SECRET \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebaseapphosting.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# R2_ACCESS_KEY_ID
gcloud secrets add-iam-policy-binding R2_ACCESS_KEY_ID \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebaseapphosting.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# R2_SECRET_ACCESS_KEY
gcloud secrets add-iam-policy-binding R2_SECRET_ACCESS_KEY \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebaseapphosting.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# VAPID_PRIVATE_KEY
gcloud secrets add-iam-policy-binding VAPID_PRIVATE_KEY \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebaseapphosting.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

echo "✅ Permissions granted to App Hosting service account!"

# ==============================================================================
# STEP 4: Grant Access to Cloud Build Service Account
# ==============================================================================

echo ""
echo "Granting access to Cloud Build service account..."

# MONGODB_URI
gcloud secrets add-iam-policy-binding MONGODB_URI \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# JWT_SECRET
gcloud secrets add-iam-policy-binding JWT_SECRET \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# R2_ACCESS_KEY_ID
gcloud secrets add-iam-policy-binding R2_ACCESS_KEY_ID \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# R2_SECRET_ACCESS_KEY
gcloud secrets add-iam-policy-binding R2_SECRET_ACCESS_KEY \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# VAPID_PRIVATE_KEY
gcloud secrets add-iam-policy-binding VAPID_PRIVATE_KEY \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

echo "✅ Permissions granted to Cloud Build service account!"

# ==============================================================================
# VERIFICATION
# ==============================================================================

echo ""
echo "Verifying secrets..."
gcloud secrets list

echo ""
echo "✅ Setup complete! You can now deploy with:"
echo "   firebase deploy --only apphosting:avutility"
