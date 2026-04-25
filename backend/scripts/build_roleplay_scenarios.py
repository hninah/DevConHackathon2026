"""Build a larger set of roleplay scenarios directly from manual chunks."""

from __future__ import annotations

import json
import os
import re
import random
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

CHUNKS_PATH = Path(os.getenv("CHUNKS_OUTPUT_PATH", "data/chunks.json"))
FRONTEND_OUTPUT_PATH = Path(
    os.getenv("SCENARIOS_OUTPUT_PATH", "../frontend/public/scenarios.json")
)
BACKEND_OUTPUT_PATH = Path(
    os.getenv("BACKEND_SCENARIOS_OUTPUT_PATH", "data/scenarios.json")
)
SCENARIO_COUNT = int(os.getenv("ROLEPLAY_SCENARIO_COUNT", "24"))
OFFICER_ONLY_MODE = "active"


def _load_chunks(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"Chunks file not found at {path.resolve()}. Run scripts/chunk_manual.py first."
        )

    with open(path, "r", encoding="utf-8") as file:
        chunks = json.load(file)

    if not isinstance(chunks, list) or not chunks:
        raise ValueError("Chunks file is empty or invalid.")

    return chunks


def _normalize(text: str, max_len: int) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned[:max_len]


def _shuffle_choices(choice_tuples: list[tuple], seed: int) -> list[tuple[str, tuple]]:
    ordered = list(choice_tuples)
    random.Random(seed).shuffle(ordered)
    choice_ids = ["a", "b", "c", "d"]
    return [(choice_ids[index], choice) for index, choice in enumerate(ordered)]


def _harden_choice_set(choice_tuples: list[tuple], seed: int) -> list[tuple]:
    """Make distractors more plausible and less obviously short than the correct option."""
    if not choice_tuples:
        return choice_tuples

    correct_text = next((text for text, is_correct, _ in choice_tuples if is_correct), "")
    target_len = max(80, len(correct_text) - 6)

    nuance_clauses = [
        "to regain control before backup arrives",
        "so the scene does not get more chaotic",
        "to keep the situation moving quickly",
        "to show authority in front of bystanders",
        "to prevent delays in the response",
        "to avoid getting stuck in a long interaction",
    ]

    hardened: list[tuple] = []
    for index, (text, is_correct, explanation) in enumerate(choice_tuples):
        if is_correct:
            hardened.append((text, is_correct, explanation))
            continue

        softened = text
        softened = re.sub(r"\bimmediately\b", "right away", softened, flags=re.IGNORECASE)
        softened = re.sub(r"\binstantly\b", "quickly", softened, flags=re.IGNORECASE)

        if len(softened) < target_len:
            clause = nuance_clauses[(seed + index) % len(nuance_clauses)]
            softened = softened.rstrip(".")
            softened = f"{softened}, {clause}."

        hardened.append((softened, is_correct, explanation))

    return hardened


def _is_usable_chunk(chunk: dict) -> bool:
    text = _normalize(str(chunk.get("text", "")), 2000)
    if len(text) < 240:
        return False

    alpha_count = sum(1 for char in text if char.isalpha())
    if alpha_count < 140:
        return False

    word_tokens = re.findall(r"[A-Za-z]{3,}", text)
    if len(word_tokens) < 70:
        return False

    lowered = text.lower()
    banned_markers = [
        "table of contents",
        "copyright",
        "all rights reserved",
        "produced by",
        "fax:",
        "email:",
        "istock",
        "collage",
        "check your knowledge",
        "post-test",
        "discussion activity",
    ]
    if any(marker in lowered for marker in banned_markers):
        return False

    return True


def _infer_module(text: str) -> str:
    lowered = text.lower()
    if "communicat" in lowered or "interview" in lowered:
        return "Communication and Dispatch"
    if "evidence" in lowered or "notebook" in lowered or "report" in lowered:
        return "Notebook and Evidence"
    if "patrol" in lowered or "hazard" in lowered or "safety" in lowered:
        return "Officer Safety"
    if "force" in lowered or "criminal" in lowered or "charter" in lowered:
        return "Use of Force and De-escalation"
    if "licence" in lowered or "act" in lowered or "legislation" in lowered:
        return "Legal Authority and Licensing"
    return "Professional Conduct"


def _infer_topic(text: str) -> str:
    lowered = text.lower()
    if "patrol" in lowered:
        return "patrol"
    if "surveillance" in lowered or "cctv" in lowered:
        return "surveillance"
    if "media" in lowered or "interview" in lowered:
        return "media"
    if "traffic" in lowered:
        return "traffic"
    if "alarm" in lowered or "emergency" in lowered:
        return "alarm_response"
    if "evidence" in lowered or "notebook" in lowered or "report" in lowered:
        return "evidence"
    return "general"


def _situation_pool() -> list[dict]:
    """Pool of vivid, realistic security guard scenario situations keyed by module."""
    return [
        # --- Use of Force and De-escalation ---
        {
            "module": "Use of Force and De-escalation",
            "name": "Mall Food Court Altercation",
            "scenarioDescription": (
                "You are a security guard at Southgate Centre mall. Two customers near the food court "
                "are shouting and shoving each other. Bystanders are filming on their phones and the area "
                "is getting crowded. You are the first guard on scene."
            ),
            "title": "Altercation: de-escalation and control",
            "part1_prompt": "The two customers are now chest-to-chest. What should you do first?",
            "part1_choices": [
                ("Use a calm, commanding voice to separate them and give clear instructions to step back.", True, "Correct. Verbal de-escalation and creating space reduces immediate danger without unnecessary force."),
                ("Physically grab both individuals immediately to stop the fight.", False, "Incorrect. Physical force should only be used when verbal control fails and it is necessary and proportionate."),
                ("Wait at a distance and call police without engaging.", False, "Incorrect. You should attempt verbal de-escalation first while waiting for backup — standing by can let the situation worsen."),
            ],
            "part2_prompt": "One person complies and steps back. The other is still aggressive and yelling. What is the best next step?",
            "part2_choices": [
                ("Continue verbal commands, position yourself between them, and call for backup.", True, "Correct. Positioning and communication reduce risk while you wait for support."),
                ("Physically restrain the aggressive person immediately.", False, "Incorrect. Exhaust verbal control options and call backup before moving to physical restraint."),
                ("Let the aggressive person leave without documenting the incident.", False, "Incorrect. You must document all security incidents regardless of outcome."),
            ],
        },
        {
            "module": "Use of Force and De-escalation",
            "name": "Impaired Person Refusing to Leave a Venue",
            "scenarioDescription": (
                "You are working security at a large concert venue. A visibly intoxicated man is standing "
                "near the stage shouting and spilling drinks on other guests. Staff have asked him to leave "
                "twice and he refuses. Your supervisor directs you to remove him."
            ),
            "title": "Removal: impaired and non-compliant person",
            "part1_prompt": "The man is swaying and verbally abusive. What should you do first?",
            "part1_choices": [
                ("Calmly identify yourself, explain why he must leave, and give him a clear direction toward the exit.", True, "Correct. Lawful verbal instruction gives the person a chance to comply before you escalate."),
                ("Immediately grab his arm and pull him toward the door.", False, "Incorrect. Physical removal without verbal instruction can escalate and cause injury."),
                ("Ignore him and wait for police to arrive on their own.", False, "Incorrect. You have a duty to act within your authority while maintaining safety."),
            ],
            "part2_prompt": "He refuses to comply a third time and plants his feet. What is the best next step?",
            "part2_choices": [
                ("Request police assistance and continue monitoring without escalating force unnecessarily.", True, "Correct. Police involvement is the appropriate escalation when voluntary compliance fails."),
                ("Use a chokehold to force him toward the exit.", False, "Incorrect. This level of force is not appropriate and could be unlawful."),
                ("Leave him alone and return to your post.", False, "Incorrect. Abandoning an active situation creates safety and liability risk."),
            ],
        },
        {
            "module": "Use of Force and De-escalation",
            "name": "Aggressive Visitor at a Hospital Entrance",
            "scenarioDescription": (
                "You are posted at the main entrance of a regional hospital. A man arrives demanding "
                "to see a patient immediately but visiting hours ended 30 minutes ago. He raises his "
                "voice, slams his hand on the reception desk, and moves toward the restricted corridor."
            ),
            "title": "Aggressive visitor: verbal control and access restriction",
            "part1_prompt": "The man is moving toward the restricted corridor. What should you do first?",
            "part1_choices": [
                ("Step into his path, identify yourself, and calmly but firmly tell him he cannot proceed.", True, "Correct. Verbal intervention and physical positioning are appropriate first steps before any force."),
                ("Let him go through and monitor from a distance.", False, "Incorrect. Allowing unauthorized access to a restricted hospital area is a safety and policy failure."),
                ("Immediately tackle him to stop his movement.", False, "Incorrect. Physical force is not justified unless there is an immediate threat of violence."),
            ],
            "part2_prompt": "He stops but begins yelling at you. What is the correct next action?",
            "part2_choices": [
                ("Stay calm, lower your voice, acknowledge his concern, and explain how to arrange an emergency visit.", True, "Correct. De-escalation through empathy and clear information can resolve the situation without force."),
                ("Yell back at him to establish authority.", False, "Incorrect. Matching aggression escalates the encounter and is unprofessional."),
                ("Immediately restrain him because he is yelling loudly.", False, "Incorrect. Yelling alone does not justify physical restraint — verbal de-escalation should continue."),
            ],
        },
        # --- Officer Safety ---
        {
            "module": "Officer Safety",
            "name": "Suspicious Person at a Transit Hub",
            "scenarioDescription": (
                "You are stationed at a light rail transit station during evening rush hour. A man is "
                "pacing erratically, talking loudly to himself, and has an oversized unattended bag. "
                "Several passengers have moved away from him and one person alerts you."
            ),
            "title": "Suspicious subject: safety assessment and approach",
            "part1_prompt": "You see the man acting erratically. What should you do first?",
            "part1_choices": [
                ("Maintain a safe distance, observe the situation, radio your position to dispatch, and assess for hazards.", True, "Correct. Safe positioning and dispatch communication come before direct engagement."),
                ("Walk directly up to the man and demand he open his bag.", False, "Incorrect. Rushing in without hazard assessment puts you and others at risk."),
                ("Ask a nearby bystander to watch the bag while you investigate.", False, "Incorrect. Bystanders must not be placed in potentially dangerous situations."),
            ],
            "part2_prompt": "You have assessed the scene. The man appears confused but not immediately violent. What now?",
            "part2_choices": [
                ("Approach calmly, introduce yourself, speak in a low tone, and ask if he is okay.", True, "Correct. A calm, low-key approach can reduce agitation and let you gather information safely."),
                ("Physically restrain him until police arrive.", False, "Incorrect. Restraint is not justified when there is no clear immediate threat."),
                ("Evacuate the entire station and wait outside.", False, "Incorrect. Proportionate response is required — a full evacuation overreacts to the situation."),
            ],
        },
        {
            "module": "Officer Safety",
            "name": "Forced Entry at a Construction Site",
            "scenarioDescription": (
                "You are on overnight patrol at a fenced construction site. Your motion sensor alert "
                "fires at 2:15 AM and you find the east gate padlock has been cut. You can see a light "
                "moving inside one of the unfinished structures."
            ),
            "title": "Trespasser: after-hours forced entry response",
            "part1_prompt": "You are at the forced gate. The site is dark and you do not know how many people are inside. What should you do first?",
            "part1_choices": [
                ("Stay outside the gate, radio dispatch with your location and the situation, and wait for backup.", True, "Correct. Entering alone into an unknown situation is high-risk. Secure your position and report first."),
                ("Enter the site immediately and confront whoever is inside.", False, "Incorrect. Entering alone without backup creates serious personal safety risk."),
                ("Leave the site and file a report in the morning.", False, "Incorrect. An active intrusion requires immediate reporting and monitoring, not deferral."),
            ],
            "part2_prompt": "Backup arrives. You find a teenager inside who got in on a dare and is cooperative. What is the correct next step?",
            "part2_choices": [
                ("Identify yourself, advise them they are trespassing, escort them out safely, and document the incident.", True, "Correct. Lawful trespass notice, safe escort, and documentation are all required steps."),
                ("Physically detain the teenager until police arrive regardless of their cooperation.", False, "Incorrect. Unnecessary detention of a cooperative person may be unlawful and excessive."),
                ("Let them go without documenting since no damage was done.", False, "Incorrect. All security incidents must be documented even when minor."),
            ],
        },
        {
            "module": "Officer Safety",
            "name": "Aggressive Dog Loose on Patrol Route",
            "scenarioDescription": (
                "You are on a foot patrol around a warehouse complex at night. As you round a corner, "
                "a large unleashed dog charges toward you from an open loading bay door. There is no "
                "handler visible and the dog is barking aggressively."
            ),
            "title": "Animal hazard: patrol safety response",
            "part1_prompt": "The dog is charging at you and there is no handler visible. What should you do first?",
            "part1_choices": [
                ("Back away slowly without running, avoid direct eye contact, and radio dispatch your exact location.", True, "Correct. Slow withdrawal and communication protect your safety without provoking the animal."),
                ("Run away as fast as possible.", False, "Incorrect. Running can trigger a chase response and increase the risk of attack."),
                ("Approach the dog to calm it with your hand.", False, "Incorrect. Approaching an aggressive dog without a handler is dangerous."),
            ],
            "part2_prompt": "The dog retreats to the loading bay. What should you do next?",
            "part2_choices": [
                ("Document the incident, notify dispatch of the open bay and the dog, and request animal control if needed.", True, "Correct. Documentation and notification ensure the hazard is addressed and logged for follow-up."),
                ("Continue your patrol through the same area immediately.", False, "Incorrect. The hazard has not been resolved — continue only once the area is confirmed safe."),
                ("Enter the loading bay alone to close the door and secure the dog.", False, "Incorrect. Entering a confined space with an aggressive animal alone creates unnecessary risk."),
            ],
        },
        # --- Communication and Dispatch ---
        {
            "module": "Communication and Dispatch",
            "name": "Radio Blackout During Alarm Response",
            "scenarioDescription": (
                "You are responding to a silent alarm at a downtown office tower at 11:50 PM. "
                "As you reach the stairwell on the fourth floor, your radio cuts out completely. "
                "You have your phone but cell signal shows one bar. You cannot confirm whether backup is coming."
            ),
            "title": "Communication failure: alarm response",
            "part1_prompt": "Your radio is down and you cannot reach dispatch. What should you do?",
            "part1_choices": [
                ("Withdraw to a position with signal, attempt contact by phone, and wait for confirmation before proceeding alone.", True, "Correct. Officer safety requires communication confirmation before solo entry into an unknown alarm situation."),
                ("Continue searching the building alone since you are already on-site.", False, "Incorrect. Proceeding without communication in an unknown alarm situation is a serious safety risk."),
                ("Reset the alarm panel yourself and leave the building.", False, "Incorrect. Resetting alarms without dispatch clearance can compromise the response and the investigation."),
            ],
            "part2_prompt": "You reach a window with signal and contact dispatch. Backup is two minutes out. What is the best next action?",
            "part2_choices": [
                ("Hold your current position, maintain visual on the stairwell entry, and update dispatch every 60 seconds.", True, "Correct. Holding position and maintaining communication keeps the response coordinated and safe."),
                ("Go back to your vehicle and wait there.", False, "Incorrect. Abandoning your observed position loses important situational awareness."),
                ("Post about the situation on the building staff group chat for speed.", False, "Incorrect. Use only official communication channels for security incidents."),
            ],
        },
        {
            "module": "Communication and Dispatch",
            "name": "Multi-Guard Coordination at a Parking Garage Fight",
            "scenarioDescription": (
                "You are the lead guard on shift at a busy indoor parking garage. A fight is reported "
                "on Level 3 and two other guards are responding from different zones. You are at the "
                "command post monitoring CCTV and radio."
            ),
            "title": "Dispatch: multi-guard incident coordination",
            "part1_prompt": "Both guards are heading to Level 3 from different directions. What should you do as the command post officer?",
            "part1_choices": [
                ("Direct each guard to approach from opposite ends, share live camera observations, and update them continuously.", True, "Correct. Coordinated approach and live CCTV updates improve safety and ensure full coverage."),
                ("Stay silent and let the responding guards figure it out themselves.", False, "Incorrect. The command post role requires active coordination, not passive observation."),
                ("Leave the command post and join the response personally.", False, "Incorrect. Abandoning the command post removes dispatch oversight and scene coordination."),
            ],
            "part2_prompt": "The situation is resolved. One guard detained a person and the other assisted an injured victim. What is your next step?",
            "part2_choices": [
                ("Document the full timeline, camera footage references, all communications, and each guard's actions.", True, "Correct. Complete incident documentation from all roles is required for accountability and legal review."),
                ("Tell each guard to write their own separate report with no shared information.", False, "Incorrect. Coordinated documentation ensures consistency and an accurate incident record."),
                ("Delete the CCTV footage now that the situation is resolved.", False, "Incorrect. CCTV footage is critical evidence and must be preserved, not deleted."),
            ],
        },
        {
            "module": "Communication and Dispatch",
            "name": "Unclear Dispatch Instructions During Fire Alarm",
            "scenarioDescription": (
                "A fire alarm activates at a large office complex where you are working. Dispatch "
                "calls you on the radio but the message cuts out mid-sentence. You hear 'evacuate' "
                "and 'east wing' but nothing else. Staff are beginning to panic in the corridor."
            ),
            "title": "Partial dispatch: fire alarm response",
            "part1_prompt": "You only caught part of the dispatch message. Staff are looking at you for direction. What should you do first?",
            "part1_choices": [
                ("Begin guiding staff toward the nearest exit while trying to re-establish radio contact to confirm the full message.", True, "Correct. Acting on the confirmed information you have — evacuation — while seeking clarification is the right balance."),
                ("Wait in place until you receive a complete message before doing anything.", False, "Incorrect. Delaying evacuation during a fire alarm to get a perfect message puts people at risk."),
                ("Tell staff to go back to their desks since the message was unclear.", False, "Incorrect. When in doubt during a fire alarm, treat it as real and begin evacuation."),
            ],
            "part2_prompt": "You have guided the east wing to the exit. You re-establish radio contact. What should you report to dispatch?",
            "part2_choices": [
                ("Your name, location, the number of people evacuated, and request confirmation of the full situation.", True, "Correct. Clear status reports with location and headcount help dispatch manage the full response."),
                ("Tell dispatch everything is fine and you handled it without further detail.", False, "Incorrect. Dispatch needs detailed updates to coordinate the broader response."),
                ("Wait for dispatch to call you rather than initiating contact.", False, "Incorrect. Proactive communication during an active emergency is part of your role."),
            ],
        },
        # --- Notebook and Evidence ---
        {
            "module": "Notebook and Evidence",
            "name": "Shoplifting Stop at a Retail Store",
            "scenarioDescription": (
                "You are a loss prevention officer at a large clothing retailer. You observed a woman "
                "on camera conceal two items in her bag and walk past all points of sale without paying. "
                "You approach her at the exit and she admits to having the items."
            ),
            "title": "Loss prevention: documentation after a stop",
            "part1_prompt": "The person has admitted to having the items. What should you do first?",
            "part1_choices": [
                ("Identify yourself, ask her to accompany you to the security office, and contact your supervisor.", True, "Correct. Proper identification and supervisor notification are your first required steps."),
                ("Physically search her bag without consent or legal authority.", False, "Incorrect. Searches require proper authority. Searching without it can be unlawful."),
                ("Accept her apology and let her go to avoid conflict.", False, "Incorrect. Incident procedure must be followed regardless of how cooperative the person is."),
            ],
            "part2_prompt": "She is cooperative and your supervisor is on the way. What should you do while you wait?",
            "part2_choices": [
                ("Start your notes: time, description of person, items observed, your actions, and the camera footage reference.", True, "Correct. Contemporary notes with specific detail and camera reference are essential evidence."),
                ("Wait until everything is finished and write the report from memory.", False, "Incorrect. Notes should be made as soon as safely possible — not reconstructed from memory."),
                ("Text the incident details to your personal phone as a backup.", False, "Incorrect. Use only official documentation channels for incident records."),
            ],
        },
        {
            "module": "Notebook and Evidence",
            "name": "Vandalism Discovered During After-Hours Patrol",
            "scenarioDescription": (
                "You are doing an overnight patrol at a school. At 1:30 AM you discover extensive "
                "graffiti and two broken windows in the east corridor. The damage appears recent "
                "and there are spray paint cans sitting on the floor."
            ),
            "title": "Scene preservation: vandalism discovery",
            "part1_prompt": "You have just discovered the vandalism and spray cans. What should you do first?",
            "part1_choices": [
                ("Do not touch anything. Secure the area, radio dispatch, and note the exact time and location.", True, "Correct. Scene preservation and timely reporting protect the evidence for police."),
                ("Pick up the spray cans to prevent further vandalism.", False, "Incorrect. Touching items at a potential crime scene can destroy fingerprints and other evidence."),
                ("Photograph the damage and post it to social media to warn the community.", False, "Incorrect. Evidence must be handled through official channels only."),
            ],
            "part2_prompt": "Police have been called and are 10 minutes away. What should you do while waiting?",
            "part2_choices": [
                ("Stand at the perimeter to preserve the scene, write a detailed description of everything observed, and wait for police.", True, "Correct. Scene preservation and detailed notes prepare you for the police handoff."),
                ("Start cleaning up so the school looks better when police arrive.", False, "Incorrect. Cleaning destroys evidence before it can be documented and photographed."),
                ("Take only a mental note and report it verbally to police when they arrive.", False, "Incorrect. Written notes made at the time are far more accurate and legally reliable than memory."),
            ],
        },
        {
            "module": "Notebook and Evidence",
            "name": "Vehicle Break-In Found in a Parking Lot",
            "scenarioDescription": (
                "You are patrolling a commercial parking lot and find a vehicle with its window "
                "smashed. Glass is on the ground and a bag appears to be missing from the back seat. "
                "A woman nearby says she saw a man running toward the east exit 5 minutes ago."
            ),
            "title": "Evidence: vehicle break-in witness and scene",
            "part1_prompt": "You find the broken vehicle. What should you do first?",
            "part1_choices": [
                ("Do not move the vehicle or glass. Note the time, location, plate number, and call dispatch.", True, "Correct. Preserving the scene and notifying dispatch are the immediate priorities."),
                ("Chase the suspect toward the east exit immediately.", False, "Incorrect. Leaving an unsecured scene and pursuing a suspect alone creates safety and evidence risks."),
                ("Move the vehicle to a safer spot to avoid further incidents.", False, "Incorrect. Moving the vehicle disturbs the evidence scene."),
            ],
            "part2_prompt": "The vehicle owner arrives and is upset. She wants to know everything right away. What should you do?",
            "part2_choices": [
                ("Stay calm, explain that police have been called, take her statement, and add it to your incident notes.", True, "Correct. Gathering the witness statement promptly and keeping her informed is good practice."),
                ("Share all investigation details with her immediately to help her feel better.", False, "Incorrect. Details of an active investigation should be shared only through proper channels."),
                ("Tell her to wait until police arrive and refuse to speak with her.", False, "Incorrect. You should acknowledge her, take her statement, and keep her informed within appropriate limits."),
            ],
        },
        # --- Legal Authority and Licensing ---
        {
            "module": "Legal Authority and Licensing",
            "name": "Trespasser Refusing to Leave Private Property",
            "scenarioDescription": (
                "You are working the gate at a private industrial park. A man on foot has entered "
                "through a gap in the perimeter fence and is in a restricted zone. When you approach, "
                "he claims he has a right to be there and refuses to identify himself or leave."
            ),
            "title": "Trespass: lawful authority and limits",
            "part1_prompt": "The man refuses to leave and denies trespassing. What should you do first?",
            "part1_choices": [
                ("Calmly explain that this is private property, that he is trespassing, and that he is required to leave.", True, "Correct. Clearly stating the trespass and the legal requirement to leave is the necessary first step."),
                ("Physically drag him off the property immediately.", False, "Incorrect. Physical removal without police involvement can expose you to legal liability."),
                ("Do nothing until he causes property damage.", False, "Incorrect. You have authority to address trespassing before damage occurs."),
            ],
            "part2_prompt": "He still refuses to leave after your second verbal direction. What is the correct next step?",
            "part2_choices": [
                ("Call police, document the encounter start time and his description, and monitor him from a safe distance.", True, "Correct. Police involvement and documentation are the correct escalation steps when verbal directions fail."),
                ("Attempt a citizen's arrest immediately.", False, "Incorrect. Citizen's arrest has specific lawful conditions that may not apply in this situation."),
                ("Walk away since your authority is limited.", False, "Incorrect. You should call police and document while maintaining safe scene awareness."),
            ],
        },
        {
            "module": "Legal Authority and Licensing",
            "name": "Media Crew Arriving at an Active Incident Scene",
            "scenarioDescription": (
                "You are guarding a perimeter around a fire that has broken out in a loading dock at a "
                "commercial property. Two reporters and a camera crew approach and demand access to film "
                "the scene. Police have not yet arrived on site."
            ),
            "title": "Media access: scene control and legal limits",
            "part1_prompt": "A reporter demands entry to the restricted scene. What should you do?",
            "part1_choices": [
                ("Politely but firmly deny entry, explain the scene is restricted for safety, and direct them to the property's communications contact.", True, "Correct. Denying unauthorized access and directing media through proper channels protects the scene."),
                ("Let them in since it is a public interest story.", False, "Incorrect. A restricted scene on private property can be maintained regardless of public interest claims."),
                ("Give a brief statement on camera to appear cooperative.", False, "Incorrect. Unauthorized statements to media can compromise an active incident response."),
            ],
            "part2_prompt": "The reporter says they have a legal right to film from the public sidewalk nearby. What should you do?",
            "part2_choices": [
                ("Acknowledge their right to film from public areas, and firmly maintain your restricted perimeter.", True, "Correct. You cannot prevent filming from public property, but you control your restricted zone."),
                ("Block their camera with your body or hand.", False, "Incorrect. Interfering with lawful media activity on public property can create legal issues for you."),
                ("Call police to have them arrested for filming near the scene.", False, "Incorrect. Filming from a public sidewalk is generally lawful — this request would not be appropriate."),
            ],
        },
        {
            "module": "Legal Authority and Licensing",
            "name": "Person Demanding to Know Why They Were Searched",
            "scenarioDescription": (
                "At a bar entrance, you conduct a routine bag check and find nothing prohibited. "
                "The guest becomes angry and demands to know your legal basis for searching them. "
                "They say they will sue and begin recording on their phone."
            ),
            "title": "Authority: lawful search and rights explanation",
            "part1_prompt": "The guest is angry and recording you. What should you do first?",
            "part1_choices": [
                ("Stay calm, explain that the search is a condition of entry on private property, and that they may decline and leave.", True, "Correct. Clear explanation of the legal basis for a consent-based search at entry is the right response."),
                ("Grab their phone to stop them from recording.", False, "Incorrect. Interfering with someone recording in a public or semi-public space is not within your authority."),
                ("Demand they stop recording before you explain anything.", False, "Incorrect. Making demands before explaining yourself escalates the situation unnecessarily."),
            ],
            "part2_prompt": "They continue to argue and say you violated their rights. What is the best next step?",
            "part2_choices": [
                ("Acknowledge their concern, reiterate the property's search policy, and offer to have a supervisor speak with them.", True, "Correct. Escalating to a supervisor for a dispute about policy is the appropriate, professional step."),
                ("Tell them they are under arrest for obstruction.", False, "Incorrect. A verbal disagreement does not meet the grounds for arrest."),
                ("Apologize and tell them the search was not required after all.", False, "Incorrect. Inconsistent explanations undermine your credibility and the property's policy."),
            ],
        },
        # --- Professional Conduct ---
        {
            "module": "Professional Conduct",
            "name": "Bomb Threat Call at a Shopping Centre",
            "scenarioDescription": (
                "You are working the main security desk at a large shopping centre. At 2:45 PM you "
                "receive a phone call from an unknown person who says there is a bomb in the building "
                "and gives a 20-minute countdown before hanging up."
            ),
            "title": "Bomb threat: emergency response procedure",
            "part1_prompt": "The caller just hung up. What should you do immediately?",
            "part1_choices": [
                ("Note the exact time, words used, voice description, and immediately alert your supervisor and call 911.", True, "Correct. Preserving call details and immediately alerting supervisors and emergency services is the correct first action."),
                ("Dismiss it as a prank and wait to see if anything happens.", False, "Incorrect. Every bomb threat must be treated as real until authorities determine otherwise."),
                ("Announce over the PA system that there is a bomb threat to warn shoppers.", False, "Incorrect. Public announcements should only be made under direction from emergency services or management to avoid panic."),
            ],
            "part2_prompt": "Emergency services are responding and your supervisor asks you to support the evacuation. What is most important?",
            "part2_choices": [
                ("Follow the site emergency plan, guide people to exits calmly, and avoid using elevators.", True, "Correct. Following the emergency plan and guiding calm evacuation is your role in this situation."),
                ("Search the building yourself to find the device before police arrive.", False, "Incorrect. Bomb searches must only be performed by trained emergency personnel — never security guards."),
                ("Lock the building entrances to contain the threat.", False, "Incorrect. Locking people inside during a bomb threat creates serious danger."),
            ],
        },
        {
            "module": "Professional Conduct",
            "name": "Witnessing Coworker Accept a Bribe at the Loading Dock",
            "scenarioDescription": (
                "During your break, you observe a fellow security guard accept cash from a delivery "
                "driver at the loading dock and wave him through without completing the required "
                "vehicle log. The guard notices you watching and says to forget about it."
            ),
            "title": "Integrity: reporting coworker misconduct",
            "part1_prompt": "Your coworker tells you to stay quiet about what you saw. What should you do?",
            "part1_choices": [
                ("Document what you witnessed with times and details, and report it to your supervisor through the official process.", True, "Correct. Security personnel have a professional duty to report misconduct through proper channels."),
                ("Agree to stay quiet since you do not want conflict with your coworker.", False, "Incorrect. Ignoring misconduct can make you complicit and violates professional standards."),
                ("Confront the coworker aggressively about what you saw.", False, "Incorrect. Direct confrontation can create conflict and evidence problems. Use official reporting channels instead."),
            ],
            "part2_prompt": "You have made your report. Your supervisor thanks you and asks you not to discuss it with others. What is the correct next step?",
            "part2_choices": [
                ("Keep the matter confidential, allow the investigation to proceed, and maintain your professionalism at work.", True, "Correct. Confidentiality and professionalism protect the investigation and your position."),
                ("Tell other coworkers what you reported to warn them.", False, "Incorrect. Discussing an active investigation can compromise it and create a hostile work environment."),
                ("Withdraw your report to avoid making things awkward.", False, "Incorrect. Reports of misconduct should not be withdrawn under social pressure."),
            ],
        },
        {
            "module": "Professional Conduct",
            "name": "Sleepy Guard Abandons Post Mid-Shift",
            "scenarioDescription": (
                "You arrive for your shift and discover the guard you are relieving has left the post "
                "30 minutes early without signing off in the log. The entrance has been unmonitored "
                "and there is no note explaining where they went."
            ),
            "title": "Conduct: abandoned post and handoff failure",
            "part1_prompt": "The post has been unmonitored for 30 minutes. What should you do first?",
            "part1_choices": [
                ("Immediately take control of the post, check for any unreported incidents, and notify your supervisor of the gap.", True, "Correct. Securing the post and reporting the gap are the immediate priorities."),
                ("Wait for the other guard to return before assuming control.", False, "Incorrect. The post needs immediate coverage — waiting leaves it unmonitored further."),
                ("Leave the post yourself since the other guard is not following policy anyway.", False, "Incorrect. Two wrongs do not make a right — you must fulfill your duty."),
            ],
            "part2_prompt": "Your supervisor asks you to document what happened. What should your notes include?",
            "part2_choices": [
                ("The time you arrived, observed state of the post, any log gaps, and your actions upon assuming the post.", True, "Correct. Accurate, factual notes covering the timeline and your actions are required."),
                ("Your personal opinion about the other guard's character and reliability.", False, "Incorrect. Notes should contain factual observations, not personal opinions."),
                ("Only the time you arrived and nothing about the missing guard.", False, "Incorrect. Documenting the full situation including the gap is necessary for accountability."),
            ],
        },
    ]


def _build_scenario(chunk: dict, index: int, role_mode: str, situation: dict) -> dict:
    page = int(chunk.get("page_number", 0))
    chunk_id = int(chunk.get("chunk_id", index))
    excerpt = _normalize(str(chunk.get("text", "")), 480)
    module = situation["module"]

    scenario_id = f"manual-{role_mode}-p{page}-c{chunk_id}"
    question_id = f"q{index + 1}"

    part1_source = _harden_choice_set(situation["part1_choices"], page * 100 + chunk_id + 11)
    part2_source = _harden_choice_set(situation["part2_choices"], page * 100 + chunk_id + 22)

    part1_choices = _shuffle_choices(part1_source, page * 100 + chunk_id + 1)
    part2_choices = _shuffle_choices(part2_source, page * 100 + chunk_id + 2)

    def _make_choice(choice_tuple: tuple, cid: str) -> dict:
        text, is_correct, explanation = choice_tuple
        return {
            "id": cid,
            "text": text,
            "isCorrect": is_correct,
            "simplifiedExplanation": explanation,
            "module": module,
        }

    return {
        "id": scenario_id,
        "name": situation["name"],
        "roleMode": role_mode,
        "sourceModule": module,
        "scenarioDescription": situation["scenarioDescription"],
        "aiPoliceChat": [
            f"Dispatch: Scenario — {situation['name']}.",
            "AI Coach: Think about lawful authority, de-escalation, and documentation.",
            "AI Coach: Apply what you know from the manual — safety first, then procedure.",
        ],
        "imagePrompt": (
            f"Realistic Alberta security training scene: {situation['name']}. "
            f"Security guard in uniform, professional setting. Manual page {page} reference."
        ),
        "questions": [
            {
                "id": question_id,
                "title": situation["title"],
                "parts": [
                    {
                        "id": f"{question_id}p1",
                        "prompt": situation["part1_prompt"],
                        "manual_reference": {
                            "page_number": page,
                            "excerpt": excerpt,
                        },
                        "choices": [
                            _make_choice(choice_tuple, choice_id)
                            for choice_id, choice_tuple in part1_choices
                        ],
                    },
                    {
                        "id": f"{question_id}p2",
                        "prompt": situation["part2_prompt"],
                        "manual_reference": {
                            "page_number": page,
                            "excerpt": excerpt,
                        },
                        "choices": [
                            _make_choice(choice_tuple, choice_id)
                            for choice_id, choice_tuple in part2_choices
                        ],
                    },
                ],
            }
        ],
    }


def build_scenarios(chunks: list[dict], scenario_count: int) -> list[dict]:
    usable = [chunk for chunk in chunks if _is_usable_chunk(chunk)]
    if not usable:
        raise ValueError("No usable chunks found to build roleplay scenarios.")

    priority_keywords = ["patrol", "surveillance", "media", "traffic", "evidence", "alarm", "report"]

    def chunk_score(chunk: dict) -> int:
        text = _normalize(str(chunk.get("text", "")), 2000).lower()
        score = 0
        for keyword in priority_keywords:
            if keyword in text:
                score += 2
        if "module three" in text or "basic security procedures" in text:
            score += 3
        page_number = int(chunk.get("page_number", 0))
        if 14 <= page_number <= 40:
            score += 2
        return score

    ranked = sorted(
        usable,
        key=lambda chunk: (chunk_score(chunk), int(chunk.get("page_number", 0))),
        reverse=True,
    )

    limit = max(2, scenario_count)
    selected = ranked[:limit]

    scenarios = []
    pool = _situation_pool()
    for index, chunk in enumerate(selected):
        role_mode = OFFICER_ONLY_MODE
        situation = pool[index % len(pool)]
        scenarios.append(_build_scenario(chunk, index, role_mode, situation))

    return scenarios


def _write_scenarios(path: Path, scenarios: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as file:
        json.dump(scenarios, file, ensure_ascii=False, indent=2)


def main() -> None:
    chunks = _load_chunks(CHUNKS_PATH)
    scenarios = build_scenarios(chunks, SCENARIO_COUNT)

    _write_scenarios(FRONTEND_OUTPUT_PATH, scenarios)
    _write_scenarios(BACKEND_OUTPUT_PATH, scenarios)

    print(f"Wrote {len(scenarios)} scenarios to {FRONTEND_OUTPUT_PATH.resolve()}")
    print(f"Wrote {len(scenarios)} scenarios to {BACKEND_OUTPUT_PATH.resolve()}")


if __name__ == "__main__":
    main()
