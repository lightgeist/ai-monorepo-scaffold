// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 atlascode-rs contributors

//! Product identity and conservative release policy. Provider identifiers stay unchanged.

pub const NAME: &str = "atlascode-rs";
/// There is no automatic or in-app update channel in the first fork release.
pub const UPDATES_ENABLED: bool = false;
