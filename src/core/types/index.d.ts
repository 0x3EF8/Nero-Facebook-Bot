/// <reference types="node" />
import { ReadStream } from "fs";
import { EventEmitter } from "events";

declare module "nero-core" {
    export type UserID = string;
    export type ThreadID = string;
    export type MessageID = string;
    export type Callback<T = any> = (err: any, result?: T) => void;

    export interface Coordinates {
        latitude: number;
        longitude: number;
    }

    export interface Mention {
        tag: string;
        id: UserID;
        fromIndex?: number;
    }

    export interface Reaction {
        reaction: string;
        userID: UserID;
    }

    export interface StickerPackInfo {
        id: string;
        name: string;
        thumbnail?: string;
    }

    export interface StickerInfo {
        type: "sticker";
        ID: string;
        url?: string;
        animatedUrl?: string;
        packID?: string;
        label: string;
        stickerID: string;
    }

    export interface AddedStickerPackInfo {
        id: string;
        name: string;
        in_sticker_tray: boolean;
        artist?: string;
        preview_image?: { uri: string };
        thumbnail_image?: { uri: string };
    }

    export interface CommentMessage {
        body: string;
        attachment?: ReadStream[];
        mentions?: Mention[];
        url?: string;
        sticker?: string;
    }

    export interface CommentResult {
        id: string;
        url: string;
        count: number;
    }

    export interface ShareResult {
        postID: string;
        url: string;
    }

    export interface Attachment {
        type:
            | "photo"
            | "animated_image"
            | "video"
            | "audio"
            | "file"
            | "sticker"
            | "share"
            | "location"
            | "unknown";
        ID: string;
        filename: string;
        url?: string;
        name?: string;
    }

    export interface PhotoAttachment extends Attachment {
        type: "photo";
        thumbnailUrl: string;
        previewUrl: string;
        previewWidth: number;
        previewHeight: number;
        largePreviewUrl: string;
        largePreviewWidth: number;
        largePreviewHeight: number;
        width: number;
        height: number;
    }

    export interface VideoAttachment extends Attachment {
        type: "video";
        duration: number;
        width: number;
        height: number;
        previewUrl: string;
        previewWidth: number;
        previewHeight: number;
        videoType: "file_attachment" | "native_video" | "unknown";
    }

    export interface AudioAttachment extends Attachment {
        type: "audio";
        duration: number;
        audioType: string;
        isVoiceMail: boolean;
    }

    export interface FileAttachment extends Attachment {
        type: "file";
        isMalicious: boolean;
        contentType: string;
    }

    export interface StickerAttachment extends Attachment {
        type: "sticker";
        packID: string;
        spriteUrl?: string;
        spriteUrl2x?: string;
        width: number;
        height: number;
        caption: string;
        description: string;
        frameCount: number;
        frameRate: number;
        framesPerRow: number;
        framesPerCol: number;
    }

    export interface ShareAttachment extends Attachment {
        type: "share";
        title: string;
        description?: string;
        source?: string;
        image?: string;
        width?: number;
        height?: number;
        playable?: boolean;
        subattachments?: any[];
        properties: Record<string, any>;
    }

    export type AnyAttachment =
        | PhotoAttachment
        | VideoAttachment
        | AudioAttachment
        | FileAttachment
        | StickerAttachment
        | ShareAttachment;

    export interface MessageReply {
        messageID: MessageID;
        senderID: UserID;
        body: string;
        attachments: AnyAttachment[];
        timestamp: string;
        isReply: true;
    }

    export interface Message {
        type: "message";
        senderID: UserID;
        body: string;
        threadID: ThreadID;
        messageID: MessageID;
        attachments: AnyAttachment[];
        mentions: Record<string, string>;
        timestamp: string;
        isGroup: boolean;
        participantIDs?: UserID[];
        messageReply?: MessageReply;
        isUnread?: boolean;
        reactions?: Reaction[];
    }

    export interface Event {
        type: "event";
        threadID: ThreadID;
        logMessageType: string;
        logMessageData: any;
        logMessageBody: string;
        timestamp: string;
        author: UserID;
    }

    export interface TypingIndicator {
        type: "typ";
        isTyping: boolean;
        from: UserID;
        threadID: ThreadID;
        fromMobile: boolean;
    }

    export type ListenEvent = Message | Event | TypingIndicator;

    export interface UserInfo {
        id: UserID;
        name: string;
        firstName: string;
        lastName?: string;
        vanity: string;
        profileUrl: string;
        profilePicUrl: string;
        gender: string;
        type: "user" | "page";
        isFriend: boolean;
        isBirthday: boolean;
        bio?: string;
        live_city?: string;
        followers?: string;
        following?: string;
        coverPhoto?: string;
    }

    export interface ThreadInfo {
        threadID: ThreadID;
        threadName?: string;
        participantIDs: UserID[];
        userInfo: UserInfo[];
        unreadCount: number;
        messageCount: number;
        imageSrc?: string;
        timestamp: string;
        muteUntil: number;
        isGroup: boolean;
        isArchived: boolean;
        isSubscribed: boolean;
        folder: string;
        nicknames: Record<UserID, string>;
        adminIDs: UserID[];
        emoji?: string;
        color?: string;
        canReply: boolean;
        inviteLink: {
            enable: boolean;
            link: string | null;
        };
    }

    export interface MessageObject {
        body?: string;
        attachment?: ReadStream[];
        sticker?: string;
        emoji?: string;
        emojiSize?: "small" | "medium" | "large";
        mentions?: Mention[];
        edit?: [string, number][];
    }

    export interface API {
        setOptions(options: LoginOptions): void;
        getAppState(): any[];
        getCurrentUserID(): UserID;

        listen(callback: (err: any, event: ListenEvent) => void): EventEmitter;

        sendMessageMqtt(
            message: string | MessageObject,
            threadID: ThreadID,
            replyToMessage?: MessageID,
            callback?: Callback<Message>
        ): void;

        editMessage(text: string, messageID: MessageID, callback?: Callback): void;

        shareContact(text: string, senderID: UserID, threadID: ThreadID, callback?: Callback): void;
        shareContact(senderID: UserID, threadID: ThreadID, callback?: Callback): void;
        resolvePhotoUrl(photoID: string, callback?: Callback<string>): Promise<string>;

        pin(action: "pin" | "unpin", threadID: ThreadID, messageID: MessageID): Promise<any>;
        pin(action: "list", threadID: ThreadID): Promise<Message[]>;

        markAsRead(threadID: ThreadID, read?: boolean, callback?: Callback): Promise<any>;
        markAsReadAll(callback?: Callback): Promise<void>;
        markAsSeen(timestamp?: number, callback?: Callback): Promise<void>;
        markAsDelivered(
            threadID: ThreadID,
            messageID: MessageID,
            callback?: Callback
        ): Promise<void>;

        sendTypingIndicator(
            sendTyping: boolean,
            threadID: ThreadID,
            callback?: Callback
        ): Promise<void>;

        getThreadInfo(threadID: ThreadID, callback?: Callback<ThreadInfo>): Promise<ThreadInfo>;
        getThreadInfo(
            threadID: ThreadID[],
            callback?: Callback<Record<ThreadID, ThreadInfo>>
        ): Promise<Record<ThreadID, ThreadInfo>>;

        getThreadList(
            limit: number,
            timestamp: number | null,
            tags: string[],
            callback?: Callback<ThreadInfo[]>
        ): Promise<ThreadInfo[]>;
        getThreadHistory(
            threadID: ThreadID,
            amount: number,
            timestamp: number | null,
            callback?: Callback<Message[]>
        ): Promise<Message[]>;

        getUserInfo(
            id: UserID,
            usePayload?: boolean,
            callback?: Callback<UserInfo>
        ): Promise<UserInfo>;
        getUserInfo(
            id: UserID[],
            usePayload?: boolean,
            callback?: Callback<Record<UserID, UserInfo>>
        ): Promise<Record<UserID, UserInfo>>;

        logout(callback?: (err: any) => void): Promise<void>;

        addExternalModule(moduleObj: Record<string, Function>): void;
        getAccess(authCode?: string, callback?: Callback<string>): Promise<string>;

        httpGet(
            url: string,
            form?: any,
            customHeader?: any,
            callback?: Callback<string>,
            notAPI?: boolean
        ): Promise<string>;
        httpPost(
            url: string,
            form?: any,
            customHeader?: any,
            callback?: Callback<string>,
            notAPI?: boolean
        ): Promise<string>;
        httpPostFormData(
            url: string,
            form?: any,
            customHeader?: any,
            callback?: Callback<string>,
            notAPI?: boolean
        ): Promise<string>;

        stickers: {
            search(query: string): Promise<StickerInfo[]>;
            listPacks(): Promise<StickerPackInfo[]>;
            getStorePacks(): Promise<StickerPackInfo[]>;
            listAllPacks(): Promise<StickerPackInfo[]>;
            addPack(packID: string): Promise<AddedStickerPackInfo>;
            getStickersInPack(packID: string): Promise<StickerInfo[]>;
            getAiStickers(options?: { limit?: number }): Promise<StickerInfo[]>;
        };

        comment(
            msg: string | CommentMessage,
            postID: string,
            replyCommentID?: string,
            callback?: Callback<CommentResult>
        ): Promise<CommentResult>;
        share(text: string, postID: string, callback?: Callback<ShareResult>): Promise<ShareResult>;
        share(postID: string, callback?: Callback<ShareResult>): Promise<ShareResult>;

        follow(senderID: UserID, follow: boolean, callback?: Callback): void;

        unsent(
            messageID: MessageID,
            threadID: ThreadID,
            callback?: Callback<UnsendMessageEvent>
        ): Promise<UnsendMessageEvent>;
        emoji(
            emoji: string,
            threadID?: ThreadID,
            callback?: Callback<EmojiEvent>
        ): Promise<EmojiEvent>;
        gcname(
            newName: string,
            threadID?: ThreadID,
            callback?: Callback<GroupNameEvent>
        ): Promise<GroupNameEvent>;
        nickname(
            nickname: string,
            threadID: ThreadID,
            participantID: UserID,
            callback?: Callback<NicknameEvent>
        ): Promise<NicknameEvent>;
        theme(
            newName: string,
            threadID?: ThreadID,
            callback?: Callback<GroupNameEvent>
        ): Promise<GroupNameEvent>;

        // ═══════════════════════════════════════════════════════════════════════
        // MESSAGE REQUEST & THREAD MANAGEMENT APIs
        // ═══════════════════════════════════════════════════════════════════════

        /**
         * Accepts or declines a message request
         * @param threadID - Thread ID or array of thread IDs
         * @param accept - true to accept (move to inbox), false to decline
         * @param callback - Optional callback
         */
        handleMessageRequest(
            threadID: ThreadID | ThreadID[],
            accept: boolean,
            callback?: Callback<HandleMessageRequestResult>
        ): Promise<HandleMessageRequestResult>;

        /**
         * Mutes or unmutes a thread's notifications
         * @param threadID - Thread ID to mute/unmute
         * @param muteSeconds - Duration: -1 (permanent), 0 (unmute), or seconds (e.g., 3600 for 1 hour)
         * @param callback - Optional callback
         */
        muteThread(
            threadID: ThreadID,
            muteSeconds: number,
            callback?: Callback<MuteThreadResult>
        ): Promise<MuteThreadResult>;

        /**
         * Creates a poll in a group chat
         * @param threadID - Group thread ID
         * @param question - Poll question text
         * @param options - Array of poll options (e.g., [{ text: "Option A" }, { text: "Option B" }])
         * @param callback - Optional callback
         */
        createPoll(
            threadID: ThreadID,
            question: string,
            options: PollOption[],
            callback?: Callback<CreatePollResult>
        ): Promise<CreatePollResult>;

        /**
         * Creates a new group chat
         * @param participantIDs - Array of user IDs (minimum 2)
         * @param groupTitle - Optional group name
         * @param callback - Optional callback
         */
        createNewGroup(
            participantIDs: UserID[],
            groupTitle?: string,
            callback?: Callback<CreateNewGroupResult>
        ): Promise<CreateNewGroupResult>;

        /** Get debug statistics for monitoring API activity */
        getDebugStats(): DebugStats;
        /** Print debug statistics to console */
        printDebugStats(): void;
        /** Reset debug statistics counters */
        resetDebugStats(): void;

        // ═══════════════════════════════════════════════════════════════════════
        // MESSAGE STORE API (Built-in Anti-Unsend Support)
        // ═══════════════════════════════════════════════════════════════════════

        /**
         * Get a stored message by ID (for anti-unsend feature)
         * Messages are automatically stored when received
         * @param messageID - The message ID to retrieve
         * @returns The stored message or null if not found/expired
         */
        getStoredMessage(messageID: MessageID): StoredMessage | null;

        [key: string]: any;
    }
    export interface LoginCredentials {
        appState?: any;
    }

    export interface LoginOptions {
        online?: boolean;
        selfListen?: boolean;
        listenEvents?: boolean;
        updatePresence?: boolean;
        forceLogin?: boolean;
        autoMarkDelivery?: boolean;
        autoMarkRead?: boolean;
        listenTyping?: boolean;
        proxy?: string;
        autoReconnect?: boolean;
        userAgent?: string;
        emitReady?: boolean;
        randomUserAgent?: boolean;
        bypassRegion?: string;
        /**
         * Debug logging level for verbose Facebook API activity.
         * - 'silent': No debug output (default)
         * - 'minimal': Only errors and critical events
         * - 'normal': Standard logging (errors, warnings, key events)
         * - 'verbose': Full debug output (all HTTP requests, MQTT events, deltas, etc.)
         */
        debugLevel?: "silent" | "minimal" | "normal" | "verbose";
        /** Enable/disable timestamps in debug output. Default: true */
        debugTimestamps?: boolean;

        // ═══════════════════════════════════════════════════════════════════════
        // ADVANCED HUMAN BEHAVIOR ANTI-DETECTION OPTIONS
        // ═══════════════════════════════════════════════════════════════════════

        /**
         * Enable advanced human-like behavior patterns to evade Facebook's automated
         * behavior detection systems. This system implements:
         *
         * - Statistical typing models with Gaussian distributions
         * - Circadian rhythm simulation (time-of-day patterns)
         * - Cognitive load modeling (fatigue, attention, emotions)
         * - Device-specific behavior profiles (mobile/desktop/tablet)
         * - Personality-based response patterns
         * - Network latency simulation
         * - Session management with breaks
         * - Adaptive rate limiting
         * - Behavioral fingerprint randomization
         *
         * Can be set to:
         * - true/false: Enable/disable with default settings
         * - HumanBehaviorConfig: Fine-tune all behavior parameters
         */
        humanBehavior?: boolean | HumanBehaviorConfig;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADVANCED HUMAN BEHAVIOR CONFIGURATION TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Device behavior profiles
     */
    export type DeviceProfile = "mobile" | "desktop" | "tablet";

    /**
     * Personality profiles affecting response patterns
     */
    export type PersonalityProfile = "casual" | "professional" | "enthusiastic" | "busy";

    /**
     * Emotional states for cognitive modeling
     */
    export type EmotionalState = "neutral" | "happy" | "stressed" | "tired" | "excited";

    /**
     * Advanced configuration for human behavior simulation
     */
    export interface HumanBehaviorConfig {
        /**
         * Device profile to simulate (affects typing speed, typo rate, etc.)
         */
        device?: DeviceProfile;

        /**
         * Personality profile (affects response times, message length, etc.)
         */
        personality?: PersonalityProfile;

        /**
         * Advanced typing dynamics configuration
         */
        typing?: {
            /** Base typing speed range in WPM */
            baseWPM?: { min: number; max: number };
            /** Character-level timing variations */
            charDelay?: {
                base?: number;
                variance?: number;
                punctuationMultiplier?: number;
                capitalMultiplier?: number;
                numberMultiplier?: number;
                specialCharMultiplier?: number;
            };
            /** Word-level timing */
            wordDelay?: {
                base?: number;
                variance?: number;
                longWordThreshold?: number;
                longWordMultiplier?: number;
            };
            /** Thinking pause configuration */
            thinkingPause?: {
                short?: { min: number; max: number };
                medium?: { min: number; max: number };
                long?: { min: number; max: number };
            };
            /** Typo simulation */
            typos?: {
                baseRate?: number;
                fatigueMultiplier?: number;
                correctionDelay?: { min: number; max: number };
                backspaceDelay?: { min: number; max: number };
            };
            /** Mid-typing pause patterns */
            midTypingPauses?: {
                enabled?: boolean;
                chancePerWord?: number;
                duration?: { min: number; max: number };
            };
        };

        /**
         * Reading & comprehension configuration
         */
        reading?: {
            /** Base reading speed range in WPM */
            baseWPM?: { min: number; max: number };
            /** Comprehension speed multipliers */
            comprehension?: {
                simpleTextMultiplier?: number;
                complexTextMultiplier?: number;
                foreignLanguageMultiplier?: number;
            };
            /** Visual scanning delay range */
            scanningDelay?: { min: number; max: number };
            /** Chance to re-read message */
            reReadChance?: number;
            /** Minimum read time in ms */
            minimumReadTime?: number;
        };

        /**
         * Circadian rhythm (24-hour patterns) configuration
         */
        circadian?: {
            /** Enable time-based behavior adjustments */
            enabled?: boolean;
            /** Activity levels by hour (0-23), 1.0 = normal */
            hourlyActivity?: Record<number, number>;
            /** Day of week multipliers (0=Sunday, 6=Saturday) */
            dayOfWeek?: Record<number, number>;
            /** Threshold below which is considered "sleep time" */
            sleepThreshold?: number;
            /** Chance to respond during sleep hours */
            sleepResponseChance?: number;
        };

        /**
         * Cognitive load modeling configuration
         */
        cognitive?: {
            /** Attention span simulation */
            attention?: {
                maxFocusTime?: number;
                focusDecayRate?: number;
                recoveryRate?: number;
                distractionChance?: number;
                distractionDuration?: { min: number; max: number };
            };
            /** Mental fatigue simulation */
            fatigue?: {
                enabled?: boolean;
                onsetTime?: number;
                maxFatigue?: number;
                recoveryMultiplier?: number;
                effectOnTyping?: number;
                effectOnErrors?: number;
            };
            /** Emotional state modeling */
            emotion?: {
                enabled?: boolean;
                transitionChance?: number;
                effectMultipliers?: Record<EmotionalState, number>;
            };
        };

        /**
         * Network latency simulation
         */
        network?: {
            latency?: {
                base?: { min: number; max: number };
                variance?: number;
                spikeChance?: number;
                spikeDuration?: { min: number; max: number };
            };
        };

        /**
         * Session management configuration
         */
        session?: {
            /** Session duration limits */
            duration?: {
                min?: number;
                max?: number;
                average?: number;
            };
            /** Break patterns */
            breaks?: {
                microBreak?: {
                    interval?: { min: number; max: number };
                    duration?: { min: number; max: number };
                    chance?: number;
                };
                shortBreak?: {
                    interval?: { min: number; max: number };
                    duration?: { min: number; max: number };
                    chance?: number;
                };
                longBreak?: {
                    interval?: { min: number; max: number };
                    duration?: { min: number; max: number };
                    chance?: number;
                };
            };
        };

        /**
         * Advanced rate limiting configuration
         */
        rateLimit?: {
            /** Per-minute limits */
            perMinute?: {
                messages?: number;
                reactions?: number;
                actions?: number;
            };
            /** Per-hour limits */
            perHour?: {
                messages?: number;
                reactions?: number;
                actions?: number;
            };
            /** Burst detection */
            burst?: {
                threshold?: number;
                window?: number;
                cooldown?: { min: number; max: number };
            };
            /** Adaptive throttling */
            adaptive?: {
                enabled?: boolean;
                warningThreshold?: number;
                throttleMultiplier?: number;
                criticalThreshold?: number;
                criticalMultiplier?: number;
            };
        };

        /**
         * Advanced behavioral fingerprint & anti-detection configuration
         */
        fingerprint?: {
            /** Basic randomization settings */
            randomization?: {
                enabled?: boolean;
                variance?: number;
                reshuffleInterval?: number;
            };

            /** Behavioral DNA generation for session uniqueness */
            behavioralDNA?: {
                typingRhythmSamples?: number;
                rhythmVariance?: number;
                regenerateInterval?: number;
            };

            /** Entropy injection for unpredictable variations */
            entropyInjection?: {
                enabled?: boolean;
                noiseLevel?: number;
                poolSize?: number;
                refreshInterval?: number;
            };

            /** Temporal variation simulation */
            temporal?: {
                enabled?: boolean;
                clockDrift?: {
                    enabled?: boolean;
                    maxDrift?: number;
                    velocity?: number;
                };
                microVariation?: {
                    enabled?: boolean;
                    amount?: number;
                };
            };

            /** Pattern breaking to avoid detection */
            patternBreaking?: {
                enabled?: boolean;
                breakInterval?: number;
                breakDuration?: number;
                breakProbability?: number;
            };

            /** Session authenticity simulation */
            sessionAuthenticity?: {
                warmupDuration?: number;
                cooldownThreshold?: number;
                phaseTransitionVariance?: number;
            };
        };
    }

    /**
     * Fingerprint state information
     */
    export interface FingerprintState {
        sessionPhase: "warmup" | "active" | "cooldown";
        consistencyScore: number;
        adjustmentFactor: number;
        patternBreakMode: boolean;
        behavioralDNA: {
            responseStyle?: "quick" | "slow" | "variable" | "consistent";
            generatedAt?: number;
        };
        entropyPoolSize: number;
        temporalDrift: number;
        actionHistorySize: number;
    }

    /**
     * Comprehensive human behavior statistics
     */
    export interface HumanBehaviorStats {
        /** Session information */
        session: {
            duration: number;
            actionCount: number;
            messageCount: number;
        };
        /** Rate limit status */
        rateLimit: {
            actionsPerMinute: number;
            actionsPerHour: number;
            burstCount: number;
            status: {
                minuteRatio: number;
                hourRatio: number;
                burstDetected: boolean;
                isWarning: boolean;
                isCritical: boolean;
            };
        };
        /** Cognitive state */
        cognitive: {
            focusLevel: number;
            fatigueLevel: number;
            emotionalState: EmotionalState;
        };
        /** Current multipliers */
        multipliers: {
            circadian: number;
            cognitive: number;
            rateLimit: number;
            variance: number;
        };
        /** Active profile */
        profile: {
            device: DeviceProfile;
            personality: PersonalityProfile;
        };
        /** Fingerprint & Anti-Detection state */
        fingerprint: FingerprintState;
        /** Status flags */
        flags: {
            isSleepTime: boolean;
            patternAnomalyDetected: boolean;
        };
        /** Legacy compatibility fields */
        actionsInLastMinute: number;
        messagesInLastMinute: number;
        consecutiveActions: number;
        sessionDuration: number;
        timeMultiplier: number;
        nearRateLimit: boolean;
    }

    /** Debug statistics for monitoring API activity */
    export interface DebugStats {
        httpRequests: number;
        httpErrors: number;
        mqttMessages: number;
        messagesReceived: number;
        messagesSent: number;
        apiCalls: number;
        uptime: number;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGE STORE TYPES (Built-in Anti-Unsend Support)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * A stored message with all its content and metadata
     * Used for anti-unsend and message recovery features
     */
    export interface StoredMessage {
        /** The message ID */
        messageID: MessageID;
        /** The thread ID where the message was sent */
        threadID: ThreadID;
        /** The sender's user ID */
        senderID: UserID;
        /** The message text content */
        body: string;
        /** When the message was sent (Unix timestamp) */
        timestamp: number;
        /** Array of attachments (photos, videos, audio, files, stickers) */
        attachments: Attachment[];
        /** Reply context if this was a reply */
        messageReply: StoredMessage | null;
        /** Whether this was in a group chat */
        isGroup: boolean;
        /** Mentions in the message */
        mentions: Record<UserID, string>;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGE REQUEST & THREAD MANAGEMENT RESULT TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    /** Result from handleMessageRequest */
    export interface HandleMessageRequestResult {
        success: boolean;
        action: "accepted" | "declined";
        threadIDs: ThreadID[];
        message: string;
    }

    /** Result from muteThread */
    export interface MuteThreadResult {
        success: boolean;
        threadID: ThreadID;
        muteSeconds: number;
        action: string;
        message: string;
    }

    /** Poll option for createPoll */
    export interface PollOption {
        text: string;
        selected?: boolean;
    }

    /** Result from createPoll */
    export interface CreatePollResult {
        success: boolean;
        threadID: ThreadID;
        question: string;
        options: PollOption[];
        message: string;
    }

    /** Result from createNewGroup */
    export interface CreateNewGroupResult {
        success: boolean;
        threadID: ThreadID;
        name: string | null;
        participantIDs: UserID[];
        totalParticipants: number;
        message: string;
    }

    export function login(
        credentials: LoginCredentials,
        options: LoginOptions | Callback<API>,
        callback?: Callback<API>
    ): void;
}
