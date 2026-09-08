-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PipelineState" AS ENUM ('DRAFT', 'ANALYZING', 'CONTINUITY_REVIEW', 'READY_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'GENERATION_QUEUED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "GenerationJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "logline" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "visualStyle" TEXT NOT NULL,
    "episodeCount" INTEGER NOT NULL,
    "episodeDurationSeconds" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "age" INTEGER NOT NULL,
    "ageRange" TEXT,
    "appearance" TEXT NOT NULL,
    "wardrobe" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "relationships" JSONB NOT NULL,
    "voiceProfile" JSONB NOT NULL,
    "continuityNotes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT,
    "visualDescription" TEXT,
    "roomDetails" TEXT,
    "lighting" TEXT,
    "visualStyle" TEXT,
    "props" JSONB NOT NULL,
    "continuityNotes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "cliffhanger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "estimatedDurationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "timeOfDay" TEXT,
    "estimatedDurationSeconds" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotNumber" INTEGER NOT NULL,
    "title" TEXT,
    "shotType" TEXT,
    "cameraAngle" TEXT,
    "framing" TEXT NOT NULL,
    "cameraMovement" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dialogue" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "characterIds" TEXT[],
    "locationId" TEXT NOT NULL,
    "continuityRequirements" JSONB NOT NULL,
    "visualPrompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "continuityNotes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Storyboard" (
    "id" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "referenceUrl" TEXT,
    "generationStatus" TEXT NOT NULL DEFAULT 'placeholder',
    "provider" TEXT,
    "generationJobId" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Storyboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesMemoryFact" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "validFromEpisode" INTEGER NOT NULL,
    "validFromScene" INTEGER,
    "validFromShot" INTEGER,
    "validToEpisode" INTEGER,
    "validToScene" INTEGER,
    "validToShot" INTEGER,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "override" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeriesMemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryEvent" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "episodeNumber" INTEGER,
    "sceneNumber" INTEGER,
    "occurredAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryFact" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT,
    "sceneId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "validFromEpisode" INTEGER,
    "validUntilEpisode" INTEGER,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "state" "PipelineState" NOT NULL,
    "output" JSONB,
    "generationJobId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "status" "AgentExecutionStatus" NOT NULL,
    "output" JSONB,
    "metadata" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExecution" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT,
    "agent" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" "AgentExecutionStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "explanation" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errors" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL,
    "requestedAction" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "projectedImpact" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "decisionAt" TIMESTAMP(3),
    "decisionNote" TEXT,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT,
    "provider" TEXT NOT NULL,
    "providerModel" TEXT,
    "providerVoiceId" TEXT,
    "characterId" TEXT,
    "language" TEXT,
    "locale" TEXT,
    "model" TEXT NOT NULL,
    "status" "GenerationJobStatus" NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "actualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "sceneId" TEXT,
    "shotId" TEXT,
    "providerJobId" TEXT,
    "generationType" TEXT NOT NULL DEFAULT 'video',
    "promptSnapshot" TEXT NOT NULL DEFAULT '',
    "negativePromptSnapshot" TEXT,
    "generationParameters" JSONB,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "errorCode" TEXT,
    "retryable" BOOLEAN,
    "cancelledAt" TIMESTAMP(3),
    "outputAssetIds" TEXT[],
    "errorMessage" TEXT,
    "lastProviderStatus" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "lastProviderError" TEXT,
    "providerMetadata" JSONB,
    "completionMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedAsset" (
    "id" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "storageUri" TEXT,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "fileSize" INTEGER,
    "provider" TEXT NOT NULL,
    "providerJobId" TEXT,
    "providerModel" TEXT,
    "providerVoiceId" TEXT,
    "characterId" TEXT,
    "language" TEXT,
    "locale" TEXT,
    "sourceTextSnapshot" TEXT,
    "codec" TEXT,
    "sampleRate" INTEGER,
    "bitrate" INTEGER,
    "channels" INTEGER,
    "fingerprint" TEXT NOT NULL,
    "checksum" TEXT,
    "generationParameters" JSONB,
    "promptSnapshot" TEXT,
    "negativePromptSnapshot" TEXT,
    "costMetadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentAssetId" TEXT,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "supersededAt" TIMESTAMP(3),
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaReview" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "reviewerActor" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "continuityAssessment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "MediaReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptionTrack" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneId" TEXT,
    "language" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptionTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptionSegment" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotId" TEXT,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "speaker" TEXT,
    "characterId" TEXT,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "CaptionSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeAssembly" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "captionTrackId" TEXT,
    "captionIncluded" BOOLEAN NOT NULL,
    "timelineDurationMs" INTEGER NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "frameRate" INTEGER NOT NULL,
    "exportPreset" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reviewState" TEXT NOT NULL,
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "validationPassed" BOOLEAN NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "inputHash" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "rebuiltFromAssemblyId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeAssembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeAssemblyItem" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "videoAssetId" TEXT,
    "audioAssetId" TEXT,
    "videoSelectionReason" TEXT,
    "audioSelectionReason" TEXT,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "sourceVideoDurationMs" INTEGER,
    "sourceAudioDurationMs" INTEGER,
    "trimInMs" INTEGER NOT NULL,
    "trimOutMs" INTEGER NOT NULL,
    "transitionType" TEXT NOT NULL,
    "transitionDurationMs" INTEGER NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "muted" BOOLEAN NOT NULL,
    "videoAudioPolicy" TEXT NOT NULL,
    "dialogueRequired" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeAssemblyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyValidationIssue" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sequence" INTEGER,
    "sceneId" TEXT,
    "shotId" TEXT,
    "assetId" TEXT,

    CONSTRAINT "AssemblyValidationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeExportJob" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "assemblyVersion" INTEGER NOT NULL,
    "exportVersion" INTEGER NOT NULL,
    "preset" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "frameRate" INTEGER NOT NULL,
    "videoCodec" TEXT NOT NULL,
    "audioCodec" TEXT NOT NULL,
    "captionMode" TEXT NOT NULL,
    "captionTrackId" TEXT,
    "engine" TEXT NOT NULL,
    "engineJobId" TEXT,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "approvalState" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvalNotes" TEXT,
    "outputUri" TEXT,
    "sidecarUri" TEXT,
    "outputFileName" TEXT,
    "fileSize" INTEGER,
    "durationMs" INTEGER,
    "checksum" TEXT,
    "engineMetadata" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryable" BOOLEAN,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeLaunchPackage" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "inputHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "preparedBy" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "seriesTitle" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "episodeTitle" TEXT NOT NULL,
    "approvedAssetIds" TEXT[],
    "captionTrackId" TEXT,
    "captionSidecarUri" TEXT,
    "rightsAttestations" JSONB NOT NULL,
    "approvalSummary" JSONB NOT NULL,
    "continuitySummary" JSONB NOT NULL,
    "readinessSnapshot" JSONB NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeLaunchPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryManifest" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "manifestVersion" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "assemblyVersion" INTEGER NOT NULL,
    "exportJobId" TEXT NOT NULL,
    "exportVersion" INTEGER NOT NULL,
    "outputId" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "videoCodec" TEXT NOT NULL,
    "audioCodec" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "captionMode" TEXT NOT NULL,
    "captionSidecarUri" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "approvalState" TEXT NOT NULL,
    "safeOutputUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchApprovalRecord" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DramaEvaluation" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "pipelineId" TEXT,
    "hookStrength" INTEGER NOT NULL,
    "conflict" INTEGER NOT NULL,
    "emotionalIntensity" INTEGER NOT NULL,
    "cliffhanger" INTEGER NOT NULL,
    "continuity" INTEGER NOT NULL,
    "pacing" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "recommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DramaEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_provider_providerSubject_key" ON "User"("provider", "providerSubject");

-- CreateIndex
CREATE INDEX "Series_ownerId_updatedAt_idx" ON "Series"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "ProductionMembership_seriesId_role_idx" ON "ProductionMembership"("seriesId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMembership_userId_seriesId_key" ON "ProductionMembership"("userId", "seriesId");

-- CreateIndex
CREATE INDEX "Character_seriesId_name_idx" ON "Character"("seriesId", "name");

-- CreateIndex
CREATE INDEX "Location_seriesId_name_idx" ON "Location"("seriesId", "name");

-- CreateIndex
CREATE INDEX "Episode_seriesId_updatedAt_idx" ON "Episode"("seriesId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_seriesId_episodeNumber_key" ON "Episode"("seriesId", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_episodeId_sceneNumber_key" ON "Scene"("episodeId", "sceneNumber");

-- CreateIndex
CREATE INDEX "Shot_seriesId_episodeId_sceneId_idx" ON "Shot"("seriesId", "episodeId", "sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "Shot_sceneId_shotNumber_key" ON "Shot"("sceneId", "shotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Storyboard_shotId_key" ON "Storyboard"("shotId");

-- CreateIndex
CREATE INDEX "SeriesMemoryFact_seriesId_subjectType_subjectId_key_idx" ON "SeriesMemoryFact"("seriesId", "subjectType", "subjectId", "key");

-- CreateIndex
CREATE INDEX "SeriesMemoryFact_seriesId_validFromEpisode_validToEpisode_idx" ON "SeriesMemoryFact"("seriesId", "validFromEpisode", "validToEpisode");

-- CreateIndex
CREATE INDEX "StoryEvent_seriesId_episodeNumber_eventType_idx" ON "StoryEvent"("seriesId", "episodeNumber", "eventType");

-- CreateIndex
CREATE INDEX "StoryFact_seriesId_category_validFromEpisode_validUntilEpis_idx" ON "StoryFact"("seriesId", "category", "validFromEpisode", "validUntilEpisode");

-- CreateIndex
CREATE INDEX "StoryFact_seriesId_subjectType_subjectId_idx" ON "StoryFact"("seriesId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "PipelineRun_seriesId_episodeId_state_idx" ON "PipelineRun"("seriesId", "episodeId", "state");

-- CreateIndex
CREATE INDEX "PipelineRun_initiatedById_updatedAt_idx" ON "PipelineRun"("initiatedById", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_pipelineId_stageKey_key" ON "PipelineStage"("pipelineId", "stageKey");

-- CreateIndex
CREATE INDEX "AgentExecution_seriesId_episodeId_timestamp_idx" ON "AgentExecution"("seriesId", "episodeId", "timestamp");

-- CreateIndex
CREATE INDEX "AgentExecution_pipelineId_agent_idx" ON "AgentExecution"("pipelineId", "agent");

-- CreateIndex
CREATE INDEX "ApprovalDecision_pipelineId_status_idx" ON "ApprovalDecision"("pipelineId", "status");

-- CreateIndex
CREATE INDEX "GenerationJob_seriesId_status_createdAt_idx" ON "GenerationJob"("seriesId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_pipelineId_idx" ON "GenerationJob"("pipelineId");

-- CreateIndex
CREATE INDEX "GenerationJob_provider_providerJobId_idx" ON "GenerationJob"("provider", "providerJobId");

-- CreateIndex
CREATE INDEX "GeneratedAsset_seriesId_episodeId_sceneId_shotId_idx" ON "GeneratedAsset"("seriesId", "episodeId", "sceneId", "shotId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedAsset_generationJobId_key" ON "GeneratedAsset"("generationJobId");

-- CreateIndex
CREATE INDEX "MediaReview_seriesId_episodeId_sceneId_shotId_assetId_idx" ON "MediaReview"("seriesId", "episodeId", "sceneId", "shotId", "assetId");

-- CreateIndex
CREATE INDEX "CaptionTrack_seriesId_episodeId_language_format_idx" ON "CaptionTrack"("seriesId", "episodeId", "language", "format");

-- CreateIndex
CREATE INDEX "CaptionTrack_episodeId_preferred_idx" ON "CaptionTrack"("episodeId", "preferred");

-- CreateIndex
CREATE INDEX "CaptionSegment_sceneId_shotId_idx" ON "CaptionSegment"("sceneId", "shotId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptionSegment_trackId_sequence_key" ON "CaptionSegment"("trackId", "sequence");

-- CreateIndex
CREATE INDEX "EpisodeAssembly_seriesId_episodeId_preferred_idx" ON "EpisodeAssembly"("seriesId", "episodeId", "preferred");

-- CreateIndex
CREATE INDEX "EpisodeAssembly_episodeId_inputHash_idx" ON "EpisodeAssembly"("episodeId", "inputHash");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeAssembly_episodeId_version_key" ON "EpisodeAssembly"("episodeId", "version");

-- CreateIndex
CREATE INDEX "EpisodeAssemblyItem_sceneId_shotId_idx" ON "EpisodeAssemblyItem"("sceneId", "shotId");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeAssemblyItem_assemblyId_sequence_key" ON "EpisodeAssemblyItem"("assemblyId", "sequence");

-- CreateIndex
CREATE INDEX "AssemblyValidationIssue_assemblyId_severity_code_idx" ON "AssemblyValidationIssue"("assemblyId", "severity", "code");

-- CreateIndex
CREATE INDEX "EpisodeExportJob_seriesId_episodeId_status_idx" ON "EpisodeExportJob"("seriesId", "episodeId", "status");

-- CreateIndex
CREATE INDEX "EpisodeExportJob_assemblyId_createdAt_idx" ON "EpisodeExportJob"("assemblyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeExportJob_episodeId_exportVersion_key" ON "EpisodeExportJob"("episodeId", "exportVersion");

-- CreateIndex
CREATE INDEX "EpisodeLaunchPackage_seriesId_episodeId_preferred_idx" ON "EpisodeLaunchPackage"("seriesId", "episodeId", "preferred");

-- CreateIndex
CREATE INDEX "EpisodeLaunchPackage_episodeId_inputHash_idx" ON "EpisodeLaunchPackage"("episodeId", "inputHash");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeLaunchPackage_episodeId_version_key" ON "EpisodeLaunchPackage"("episodeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryManifest_packageId_key" ON "DeliveryManifest"("packageId");

-- CreateIndex
CREATE INDEX "DeliveryManifest_seriesId_episodeId_exportJobId_idx" ON "DeliveryManifest"("seriesId", "episodeId", "exportJobId");

-- CreateIndex
CREATE INDEX "LaunchApprovalRecord_packageId_decidedAt_idx" ON "LaunchApprovalRecord"("packageId", "decidedAt");

-- CreateIndex
CREATE INDEX "DramaEvaluation_episodeId_createdAt_idx" ON "DramaEvaluation"("episodeId", "createdAt");

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMembership" ADD CONSTRAINT "ProductionMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMembership" ADD CONSTRAINT "ProductionMembership_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "Shot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesMemoryFact" ADD CONSTRAINT "SeriesMemoryFact_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryEvent" ADD CONSTRAINT "StoryEvent_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryFact" ADD CONSTRAINT "StoryFact_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecution" ADD CONSTRAINT "AgentExecution_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "PipelineRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAsset" ADD CONSTRAINT "GeneratedAsset_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaReview" ADD CONSTRAINT "MediaReview_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "GeneratedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptionTrack" ADD CONSTRAINT "CaptionTrack_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptionTrack" ADD CONSTRAINT "CaptionTrack_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptionTrack" ADD CONSTRAINT "CaptionTrack_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptionSegment" ADD CONSTRAINT "CaptionSegment_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "CaptionTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeAssembly" ADD CONSTRAINT "EpisodeAssembly_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeAssembly" ADD CONSTRAINT "EpisodeAssembly_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeAssemblyItem" ADD CONSTRAINT "EpisodeAssemblyItem_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "EpisodeAssembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyValidationIssue" ADD CONSTRAINT "AssemblyValidationIssue_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "EpisodeAssembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeExportJob" ADD CONSTRAINT "EpisodeExportJob_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeExportJob" ADD CONSTRAINT "EpisodeExportJob_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeExportJob" ADD CONSTRAINT "EpisodeExportJob_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "EpisodeAssembly"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeLaunchPackage" ADD CONSTRAINT "EpisodeLaunchPackage_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeLaunchPackage" ADD CONSTRAINT "EpisodeLaunchPackage_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryManifest" ADD CONSTRAINT "DeliveryManifest_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EpisodeLaunchPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchApprovalRecord" ADD CONSTRAINT "LaunchApprovalRecord_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EpisodeLaunchPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DramaEvaluation" ADD CONSTRAINT "DramaEvaluation_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
