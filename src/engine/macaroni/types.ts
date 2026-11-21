/**
 * Macroni Overhaul 1.2 — Macro Language Types & Definitions
 * Strict sigil-first symbolic grammar:
 *   ==  neutral stored object
 *   <<  pull (evaluates and displays result over formula)
 *   <>  make (popup result with exit)
 *   <?> query (clickable option dialog)
 *   <^> modifier (adds/updates buff in Buff Box by name + bonusType)
 *   <!> stepper (temporary window with step/reset, current step & result)
 *   >target<op value  merge (field mutation or non-mutating object composition)
 */

import {
  PF1Character,
  UiMakePreset,
  BuffBonusType,
  BuffStatTarget,
} from '../../types/character';

export type MacaroniSigil = '==' | '<<' | '<>' | '<?>' | '<^>' | '<!>' | 'merge';

export type MacaroniSigilKind =
  | 'neutral'
  | 'pull'
  | 'make'
  | 'query'
  | 'modifier'
  | 'stepper'
  | 'merge';

export type MergeOperator = '+' | '-' | '*' | '/' | '=';

export interface MacaroniSigilEnvelope {
  valid: boolean;
  sigil?: MacaroniSigil;
  kind?: MacaroniSigilKind;
  body: string;
  errorMessage?: string;
  mergeTarget?: string;
  mergeIsObject?: boolean;
  mergeOperator?: MergeOperator;
  mergeValueExpr?: string;
}

export type MacaroniTokenType =
  | 'sigil_neutral'
  | 'sigil_pull'
  | 'sigil_make'
  | 'sigil_query'
  | 'sigil_modifier'
  | 'sigil_stepper'
  | 'sigil_merge'
  | 'object_ref'
  | 'array_ref'
  | 'scope_ref'
  | 'dice_object'
  | 'legacy_hash_call'
  | 'reserved_symbol'
  | 'calc_open'
  | 'calc_close'
  | 'stepper_bang'
  | 'text_literal'
  | 'number'
  | 'operator'
  | 'pipe_branch'
  | 'equals_op'
  | 'inert_text'
  | 'error_token';

export interface MacaroniToken {
  type: MacaroniTokenType;
  value: string;
  raw: string;
  start?: number;
  end?: number;
  bangId?: string;
}

export interface MacaroniSlotResult {
  slot: number;
  label?: string;
  raw: string;
  evaluated: string;
  isNumericOnly: boolean;
  diceOutcome?: unknown;
}

export interface MacaroniBuffMakeSpec {
  raw: string;
  name?: string;
  isDirectMatrix: boolean;
  isLockedOnce: boolean;
  category: 'activatable' | 'permanent' | 'debuff';
  bonusType: BuffBonusType;
  values: Partial<Record<BuffStatTarget, number>>;
  matrixEntries: Array<{
    col?: number;
    row?: number;
    stat: BuffStatTarget;
    bonusType: BuffBonusType;
    value: number;
  }>;
  summaryText: string;
}

export interface MacaroniQueryOption {
  label: string;
  value: string;
  objectName?: string;
  targetSigil?: MacaroniSigilKind | 'none';
  targetFormula?: string;
  isStat?: boolean;
  isCustomInput?: boolean;
}

export interface MacaroniQueryRequest {
  id: string;
  prompt: string;
  options: MacaroniQueryOption[];
  depth?: number;
  visitedQueryKeys?: string[];
  inlineCallSite?: {
    targetQueryName: string;
    parentExpression: string;
  };
  onSelect: (chosenValue: string) => void;
  onCancel?: () => void;
}

export interface MacaroniModifierPrompt {
  evaluatedValue: string;
  numericValue: number;
  suggestedName?: string;
  suggestedTarget?: BuffStatTarget;
  suggestedBonusType?: BuffBonusType;
}

export interface MacaroniStepperWindow {
  formula: string;
  currentStep: number;
  result: string;
  bangIds: string[];
}

export interface MacaroniMergeResult {
  kind: 'field' | 'object';
  target: string;
  operator: MergeOperator;
  valueExpr: string;
  evaluatedOperand: string;
  previousValue?: number;
  newValue?: number | string;
  effectiveExpression?: string;
}

export interface MacaroniTraceStep {
  stage: string;
  before: string;
  after: string;
  note?: string;
}

export interface MacaroniListenerEntry {
  name: string;
  allowedSenders?: string[];
  lastValue?: string | number | string[];
  updatedAt?: number;
  revoked?: boolean;
}

export interface MacaroniScopePermissions {
  allowWrite?: boolean;
  allowModifier?: boolean;
  allowStepper?: boolean;
  readAllowlist?: string[];
  revokedSenders?: string[];
  listeners?: Record<string, MacaroniListenerEntry>;
}

export interface MacaroniExternalSheet {
  id: string;
  name: string;
  character: PF1Character;
  formulaContext?: Record<string, unknown>;
  permissions?: MacaroniScopePermissions;
}

export interface MacaroniScopeAccessEvent {
  kind: 'private_read' | 'listener_push' | 'permission_denied';
  targetSheet?: string;
  targetField?: string;
  listenerName?: string;
  value?: string | number | string[];
  isPrivate?: boolean;
  note: string;
}

export interface NoodleTextSegment {
  text: string;
  bold: boolean;
  underline: boolean;
  color?: string;
}

export interface MacaroniExecutionResult {
  raw: string;
  fullOutput: string;
  slots: MacaroniSlotResult[];
  isError: boolean;
  errorMessage?: string;
  tokens: MacaroniToken[];
  rollable: boolean;
  sigil?: MacaroniSigil;
  sigilKind?: MacaroniSigilKind;
  isNoOp?: boolean;
  privateOutput?: boolean;
  makePopup?: {
    title: string;
    result: string;
    rawBody: string;
  };
  alertEvents?: Array<{ tag?: number; message: string; preset?: UiMakePreset }>;
  buffMakeEvents?: MacaroniBuffMakeSpec[];
  modifierPrompt?: MacaroniModifierPrompt;
  stepperWindow?: MacaroniStepperWindow;
  mergeResult?: MacaroniMergeResult;
  queryEvent?: MacaroniQueryRequest;
  appliedPushes?: string[];
  stateMutations?: Array<{ field: string; delta: number; absoluteValue?: number; description: string }>;
  diceRolls?: Array<{ die: string; sides: number; rolled: number }>;
  stepperSnapshots?: Array<{ bangId: string; step: number }>;
  scopeEvents?: MacaroniScopeAccessEvent[];
  traceSteps?: MacaroniTraceStep[];
  isFinished?: boolean;
  quirkyMessage?: string;
}

export interface FloatingAlertPayload {
  id: string;
  message: string;
  tag?: number;
  preset?: UiMakePreset;
  timestamp: number;
}
