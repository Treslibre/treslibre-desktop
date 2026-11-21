// Modified 2026 by Treslibre Project (Treslibre).
//! Contact structs.
use std::collections::HashMap;

use super::provider::{ContactProvider, ProviderError, SettingsProvider};
use crate::{
    common::{Delta, FeatureMask, ThreemaId, config::Config, keys::PublicKey},
    protobuf::{self, d2d_sync::contact as protobuf_contact},
    utils::{
        apply::{Apply as _, TryApply},
        time::utc_now_ms,
    },
};

/// A contact could not be updated.
#[derive(Debug, thiserror::Error)]
pub(crate) enum ContactUpdateError {
    /// Contact could not be updated because the identity does not match.
    #[error("Identity mismatch: Expected {expected} but got {actual}")]
    IdentityMismatch { expected: ThreemaId, actual: ThreemaId },

    /// Contact could not be updated because the public key does not match.
    #[error("Public key mismatch")]
    PublicKeyMismatch,
}

#[derive(Debug)]
pub(crate) enum CommunicationPermission {
    /// Communication with this contact is allowed.
    Allow,

    /// Communication with this contact is disallowed due to it being explicitly blocked.
    BlockExplicit,

    /// Communication with this contact is disallowed due to it being implicitly blocked by the _block
    /// unknown_ setting.
    ///
    /// Note: This is purely informational, i.e. when encountering this, the behaviour must be the same as for
    /// [`CommunicationPermission::BlockExplicit`]. Communication would be allowed after the contact has been
    /// explicitly added or both the user and the contact are in a group not marked as _left_.
    BlockUnknown,
}

/// All protocol relevant data associated to a contact with the following exclusions:
///
/// - _contact-defined_ profile picture
/// - _user-defined_ profile picture
//-
// IMPORTANT: When touching these, always make sure to update [`ContactUpdate`] and
// `ContactUpdate::apply_to` accordingly.
#[derive(Debug, Clone)]
pub struct Contact {
    /// Threema ID of the contact.
    pub identity: ThreemaId,

    /// Public key of the contact.
    pub public_key: PublicKey,

    /// Unix-ish timestamp in milliseconds when the contact has been created (added) locally.
    pub created_at: u64,

    /// First name of the contact.
    pub first_name: Option<String>,

    /// Last name of the contact.
    pub last_name: Option<String>,

    /// Nickname of the contact (without `~` prefix).
    ///
    /// IMPORTANT: Do not provide the Threema ID as a fallback!
    pub nickname: Option<String>,

    /// Verification level of the contact.
    pub verification_level: protobuf_contact::VerificationLevel,

    /// Threema Work verification level of the contact.
    pub work_verification_level: protobuf_contact::WorkVerificationLevel,

    /// Identity type of the contact.
    pub identity_type: protobuf_contact::IdentityType,

    /// Acquaintance level of the contact.
    pub acquaintance_level: protobuf_contact::AcquaintanceLevel,

    /// Activity state of the contact.
    pub activity_state: protobuf_contact::ActivityState,

    /// Features available for the contact.
    pub feature_mask: FeatureMask,

    /// Contact synchronisation state.
    pub sync_state: protobuf_contact::SyncState,

    /// The last full sync of this contact. Must not be present in non-work
    /// builds.
    pub work_last_full_sync_at: Option<u64>,

    /// Work availability status of the contact.
    pub work_availability_status: Option<protobuf::d2d_sync::WorkAvailabilityStatus>,

    /// _Read_ receipt policy override for this contact.
    pub read_receipt_policy_override: Option<protobuf::d2d_sync::ReadReceiptPolicy>,

    /// Typing indicator policy override for this contact.
    pub typing_indicator_policy_override: Option<protobuf::d2d_sync::TypingIndicatorPolicy>,

    /// Notification trigger policy for the contact.
    pub notification_trigger_policy_override:
        Option<protobuf_contact::notification_trigger_policy_override::Policy>,

    /// Conversation category of the contact.
    pub conversation_category: protobuf::d2d_sync::ConversationCategory,

    /// Conversation visibility of the contact.
    pub conversation_visibility: protobuf::d2d_sync::ConversationVisibility,
}

/// All protocol relevant data associated to create a contact with the following exclusions:
///
/// - _contact-defined_ profile picture
/// - _user-defined_ profile picture
pub type ContactInit = Contact;

#[derive(Debug)]
pub(crate) enum ContactOrInit {
    ExistingContact(Contact),
    NewContact(ContactInit),
}
impl ContactOrInit {
    #[inline]
    pub(crate) const fn inner(&self) -> &Contact {
        match self {
            ContactOrInit::NewContact(contact) | ContactOrInit::ExistingContact(contact) => contact,
        }
    }

    pub(crate) fn communication_permission(
        &self,
        config: &Config,
        settings_provider: &dyn SettingsProvider,
        contact_provider: &dyn ContactProvider,
    ) -> Result<CommunicationPermission, ProviderError> {
        let inner = self.inner();
        let predefined_contact = config.predefined_contacts.get(&inner.identity);

        // Special contacts cannot be blocked
        if predefined_contact.is_some_and(|contact| contact.special) {
            return Ok(CommunicationPermission::Allow);
        }

        // Check if the user explicitly blocked the contact
        if contact_provider.is_explicitly_blocked(inner.identity)? {
            return Ok(CommunicationPermission::BlockExplicit);
        }

        // Check if the user wants to block _unknown_ identities.
        if !settings_provider.block_unknown_identities()? {
            return Ok(CommunicationPermission::Allow);
        }

        // Predefined contacts should not be implicitly blocked
        if predefined_contact.is_some() {
            return Ok(CommunicationPermission::Allow);
        }

        Ok(match &self {
            ContactOrInit::NewContact(_) => {
                // The contact does not exist and block unknown is active
                CommunicationPermission::BlockUnknown
            },

            ContactOrInit::ExistingContact(inner) => {
                // Check if the contact has acquaintance level _direct_
                if inner.acquaintance_level == protobuf_contact::AcquaintanceLevel::Direct {
                    return Ok(CommunicationPermission::Allow);
                }

                // Check if the user and the contact are part of an active group
                if contact_provider.is_member_of_active_group(inner.identity)? {
                    CommunicationPermission::Allow
                } else {
                    CommunicationPermission::BlockUnknown
                }
            },
        })
    }
}

/// All protocol relevant data associated to update a contact with the following exclusions:
///
/// - _contact-defined_ profile picture
/// - _user-defined_ profile picture
///
/// Note: This may only include changes to a contact.
#[derive(Debug, Clone, PartialEq)]
pub struct ContactUpdate {
    /// Threema ID of the contact.
    pub identity: ThreemaId,

    /// First name of the contact.
    pub first_name: Delta<String>,

    /// Last name of the contact.
    pub last_name: Delta<String>,

    /// Nickname of the contact (without `~` prefix).
    ///
    /// IMPORTANT: Do not provide the Threema ID as a fallback!
    pub nickname: Delta<String>,

    /// Verification level of the contact.
    pub verification_level: Option<protobuf_contact::VerificationLevel>,

    /// Threema Work verification level of the contact.
    pub work_verification_level: Option<protobuf_contact::WorkVerificationLevel>,

    /// Identity type of the contact.
    pub identity_type: Option<protobuf_contact::IdentityType>,

    /// Acquaintance level of the contact.
    pub acquaintance_level: Option<protobuf_contact::AcquaintanceLevel>,

    /// Activity state of the contact.
    pub activity_state: Option<protobuf_contact::ActivityState>,

    /// Features available for the contact.
    pub feature_mask: Option<FeatureMask>,

    /// Contact synchronisation state.
    pub sync_state: Option<protobuf_contact::SyncState>,

    /// _Read_ receipt policy override for this contact.
    pub read_receipt_policy_override: Delta<protobuf::d2d_sync::ReadReceiptPolicy>,

    /// Typing indicator policy override for this contact.
    pub typing_indicator_policy_override: Delta<protobuf::d2d_sync::TypingIndicatorPolicy>,

    /// Notification trigger policy for the contact.
    pub notification_trigger_policy_override:
        Delta<protobuf_contact::notification_trigger_policy_override::Policy>,

    /// Conversation category of the contact.
    pub conversation_category: Option<protobuf::d2d_sync::ConversationCategory>,

    /// Conversation visibility of the contact.
    pub conversation_visibility: Option<protobuf::d2d_sync::ConversationVisibility>,

    /// Work availability status of the contact.
    pub work_availability_status: Option<protobuf::d2d_sync::WorkAvailabilityStatus>,

    /// The last full sync of this contact. Must not be present in non-work
    /// builds.
    pub work_last_full_sync_at: Option<u64>,
}

impl ContactUpdate {
    pub(crate) fn default(identity: ThreemaId) -> Self {
        Self {
            identity,
            first_name: Delta::Unchanged,
            last_name: Delta::Unchanged,
            nickname: Delta::Unchanged,
            verification_level: None,
            work_verification_level: None,
            identity_type: None,
            acquaintance_level: None,
            activity_state: None,
            feature_mask: None,
            sync_state: None,
            read_receipt_policy_override: Delta::Unchanged,
            typing_indicator_policy_override: Delta::Unchanged,
            notification_trigger_policy_override: Delta::Unchanged,
            conversation_category: None,
            conversation_visibility: None,
            work_availability_status: None,
            work_last_full_sync_at: None,
        }
    }

    pub(crate) fn has_changes(&self) -> bool {
        self != &Self::default(self.identity)
    }
}
impl TryApply<ContactUpdate> for Contact {
    type Error = ContactUpdateError;

    /// Try applying the contact update to the contact.
    ///
    /// # Errors
    ///
    /// Returns [`ContactUpdateError`] if the identity mismatches.
    fn try_apply(&mut self, value: ContactUpdate) -> Result<(), Self::Error> {
        // Unpacking here, so we can't miss updating this function when a new field is being added
        let ContactUpdate {
            identity,
            first_name,
            last_name,
            nickname,
            verification_level,
            work_verification_level,
            identity_type,
            acquaintance_level,
            activity_state,
            feature_mask,
            sync_state,
            read_receipt_policy_override,
            typing_indicator_policy_override,
            notification_trigger_policy_override,
            conversation_category,
            conversation_visibility,
            work_availability_status,
            work_last_full_sync_at,
        } = value;

        // Ensure the identity equals before updating
        if identity != self.identity {
            return Err(ContactUpdateError::IdentityMismatch {
                expected: self.identity,
                actual: identity,
            });
        }

        // Update all properties
        self.first_name.apply(first_name);
        self.last_name.apply(last_name);
        self.nickname.apply(nickname);
        self.verification_level = verification_level.unwrap_or(self.verification_level);
        self.work_verification_level = work_verification_level.unwrap_or(self.work_verification_level);
        self.identity_type = identity_type.unwrap_or(self.identity_type);
        self.acquaintance_level = acquaintance_level.unwrap_or(self.acquaintance_level);
        self.activity_state = activity_state.unwrap_or(self.activity_state);
        self.feature_mask = feature_mask.unwrap_or(self.feature_mask);
        self.sync_state = sync_state.unwrap_or(self.sync_state);
        self.read_receipt_policy_override
            .apply(read_receipt_policy_override);
        self.typing_indicator_policy_override
            .apply(typing_indicator_policy_override);
        self.notification_trigger_policy_override
            .apply(notification_trigger_policy_override);
        self.conversation_category = conversation_category.unwrap_or(self.conversation_category);
        self.conversation_visibility = conversation_visibility.unwrap_or(self.conversation_visibility);
        self.work_availability_status = work_availability_status;
        self.work_last_full_sync_at = work_last_full_sync_at;

        // Done
        Ok(())
    }
}

/// A predefined contact that does not need to be fetched from the directory.
///
/// It is automatically elevated to the highest verification level.
#[derive(Debug, Clone)]
pub struct PredefinedContact {
    /// Threema ID of the predefined contact.
    pub identity: ThreemaId,

    /// Whether the predefined contact is marked as a _special contact_.
    pub special: bool,

    /// Public key of the predefined contact.
    pub public_key: PublicKey,

    /// Nickname of the contact (without `~` prefix).
    pub nickname: String,
}
impl PredefinedContact {
    pub(crate) const _3MAPUSH_IDENTITY: ThreemaId = ThreemaId::predefined(*b"*3MAPUSH");

    pub(crate) fn production() -> HashMap<ThreemaId, Self> {
        HashMap::new()
    }

    pub(crate) fn sandbox() -> HashMap<ThreemaId, Self> {
        HashMap::new()
    }

    pub(crate) fn update(&self, contact: &mut Contact) -> Result<(), ContactUpdateError> {
        let Self {
            identity,
            special: _special,
            public_key,
            nickname,
        } = self;

        // Ensure the identity and public key equal before updating
        if *identity != contact.identity {
            return Err(ContactUpdateError::IdentityMismatch {
                expected: contact.identity,
                actual: *identity,
            });
        }
        if *public_key != contact.public_key {
            return Err(ContactUpdateError::PublicKeyMismatch);
        }

        // Bump verification level
        contact.verification_level = protobuf_contact::VerificationLevel::FullyVerified;

        // Update nickname
        contact.nickname = Some(nickname.clone());

        // Done
        Ok(())
    }
}

impl From<&PredefinedContact> for ContactInit {
    fn from(predefined_contact: &PredefinedContact) -> Self {
        Self {
            identity: predefined_contact.identity,
            public_key: predefined_contact.public_key,
            created_at: utc_now_ms(),
            first_name: None,
            last_name: None,
            nickname: Some(predefined_contact.nickname.clone()),
            verification_level: protobuf_contact::VerificationLevel::FullyVerified,
            work_verification_level: protobuf_contact::WorkVerificationLevel::None,
            // Gateway IDs are semantically neither identity type but, eh, whatever.
            identity_type: protobuf_contact::IdentityType::Regular,
            acquaintance_level: protobuf_contact::AcquaintanceLevel::GroupOrDeleted,
            activity_state: protobuf_contact::ActivityState::Active,
            feature_mask: FeatureMask(FeatureMask::NONE),
            sync_state: protobuf_contact::SyncState::Initial,
            read_receipt_policy_override: None,
            typing_indicator_policy_override: None,
            notification_trigger_policy_override: None,
            conversation_category: protobuf::d2d_sync::ConversationCategory::Default,
            conversation_visibility: protobuf::d2d_sync::ConversationVisibility::Normal,
            work_availability_status: None,
            work_last_full_sync_at: None,
        }
    }
}
