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
                "are shouting and shoving each other. The crowd is growing and bystanders are filming. "
                "You are the first guard on scene."
            ),
            "title": "Altercation: crowd control and backup",
            "part1_prompt": "The crowd around the fight is growing fast. The manual identifies a specific first action when an incident involves a crowd. What is it?",
            "part1_choices": [
                ("Call for backup at the first sign of a crowd incident — do not wait for it to escalate before asking for help.", True, "Correct. The manual states: 'Call for back-up at the first sign of an incident as it can turn from something minor into something quite large.' Backup must be called immediately, not after things worsen."),
                ("Handle the crowd yourself first and call backup only if you cannot get the situation under control.", False, "Incorrect. The manual says to call backup at the first sign of trouble — waiting until you are overwhelmed is too late and unsafe."),
                ("Announce loudly that police are on their way and that everyone must leave immediately.", False, "Incorrect. A loud announcement can escalate crowd panic. The manual recommends de-escalation and calling backup, not triggering a stampede."),
            ],
            "part2_prompt": "The crowd is still growing. The manual describes a strategy for breaking down a crowd. What is the recommended approach?",
            "part2_choices": [
                ("Try to remove the most vocal leaders of the crowd — de-escalating the leaders can calm the group as a whole.", True, "Correct. The manual's strategy is: 'Remove the Leaders. One strategy you should keep in mind is to always try to de-escalate a crowd by removing its leaders.' Isolating the instigators drains the crowd's energy."),
                ("Position yourself in the centre of the crowd to show authority and take control physically.", False, "Incorrect. The manual warns that lone officers cannot contain an out-of-control crowd. Placing yourself in the middle is dangerous and ineffective."),
                ("Tell bystanders they are legally required to leave and will be detained if they stay.", False, "Incorrect. Bystanders have no legal obligation to leave a public area, and making false threats about detention can escalate the situation and expose you to liability."),
            ],
        },
        {
            "module": "Use of Force and De-escalation",
            "name": "Impaired Person Refusing to Leave a Venue",
            "scenarioDescription": (
                "You are working security at a large concert venue. A man near the stage is acting "
                "erratically — swaying, slurring his words, bumping into guests, and shouting. Staff "
                "have asked him to leave twice and he refuses. Your supervisor directs you to deal with it."
            ),
            "title": "Impairment: recognizing signs and responding",
            "part1_prompt": "Before approaching, you want to confirm the man is actually impaired and not experiencing a medical episode. Which combination of signs does the manual specifically list as indicators of substance impairment?",
            "part1_choices": [
                ("Bloodshot eyes, slurred speech, poor coordination, and tremors — all listed as physical signs of impairment.", True, "Correct. The manual lists bloodshot eyes, slurred speech, poor coordination, and tremors (shaking) as physical signs of substance abuse. Seeing these helps distinguish impairment from a medical condition like a stroke."),
                ("Wearing sunglasses indoors and carrying an unusually large bag — signs the person is hiding something.", False, "Incorrect. These are loss-prevention indicators, not impairment signs. The manual's list of substance abuse indicators includes slurred speech, poor coordination, tremors, and bloodshot eyes."),
                ("Refusing to answer questions and walking quickly away from security — signs of guilt and impairment.", False, "Incorrect. These behaviours may indicate awareness of security but are not on the manual's list of physical impairment signs. Behavioural signs include secretive behaviour, but the physical signs are different."),
            ],
            "part2_prompt": "You have confirmed he is impaired. He refuses to leave a third time and plants his feet. What is the appropriate next step according to the manual?",
            "part2_choices": [
                ("Request police assistance and continue monitoring — do not escalate to physical force when verbal compliance has failed.", True, "Correct. The manual says most situations can be handled through skilled communication, and escalating to force is risky. When verbal means are exhausted, police involvement is the correct next escalation."),
                ("Use a restraint hold to guide him toward the exit since he has been given three chances to leave.", False, "Incorrect. Section 26 of the Criminal Code makes every person criminally responsible for excessive force. A restraint on a non-violent impaired person who is only refusing to walk creates serious legal exposure."),
                ("Leave him alone and return to your post since you cannot physically force him to move.", False, "Incorrect. Abandoning an active situation without completing your duty is a conduct failure. Call police to assist — do not simply walk away."),
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
            "part1_prompt": "You are at the forced gate and can see evidence of a break-in. What does the manual say you must do first upon finding a scene like this?",
            "part1_choices": [
                ("Stay outside, radio dispatch with your location, and notify police immediately — do not enter alone or disturb anything.", True, "Correct. The manual states: if you see evidence of a break-in or criminal activity, notify the police immediately and take care not to displace or destroy evidence. Do not enter alone."),
                ("Enter the site immediately to locate and confront whoever is inside before they escape.", False, "Incorrect. The manual requires you to notify police and secure your position first. Entering alone into an unknown situation without backup is unsafe and can destroy evidence."),
                ("Inspect every entrance to determine exactly how many people entered before calling anyone.", False, "Incorrect. The manual says to notify police immediately and avoid disturbing the scene. A full solo perimeter check before calling in delays the response unnecessarily."),
            ],
            "part2_prompt": "Police and backup arrive. They find a teenager inside who got in on a dare and cooperates fully. What is the correct next step for you?",
            "part2_choices": [
                ("Identify yourself, advise them they are trespassing, escort them out safely, and document the full incident in your notebook.", True, "Correct. Lawful trespass notice, safe escort, and thorough documentation are all required steps — even for a cooperative minor."),
                ("Physically detain the teenager until police decide what to do, regardless of their cooperation.", False, "Incorrect. Unnecessary physical detention of a cooperative person who is being escorted out can be unlawful and is disproportionate."),
                ("Let them go without documenting since police are already on scene and no damage was done.", False, "Incorrect. You must document all security incidents, including trespass. Your report is your record regardless of what police do."),
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
                "You are a loss prevention officer at a large clothing retailer. You have been watching "
                "a man on CCTV who appears furtive — glancing at cameras, wearing an unusually bulky coat "
                "on a warm day, and carrying a large backpack. He conceals two items inside the backpack "
                "and is now walking toward the exit."
            ),
            "title": "Loss prevention: detention timing and documentation",
            "part1_prompt": "The man has concealed the items but is still inside the store near the last cashier. Should you stop him now?",
            "part1_choices": [
                ("No — wait until he has passed all cashiers and left the store before approaching him.", True, "Correct. The Alberta manual states theft is not considered complete until the subject has passed all checkout areas and left the store. Stopping earlier lets him claim he intended to pay."),
                ("Yes — confront him now before he has a chance to run.", False, "Incorrect. The manual says the offence of theft should not be considered complete until the subject passes all cashiers and has left the store. Detaining him inside gives him a legal defence."),
                ("Yes — you already have video evidence so it doesn't matter where you stop him.", False, "Incorrect. Where you stop him affects whether the theft is legally complete. The manual is clear: wait until he is past all cashiers and outside."),
            ],
            "part2_prompt": "He has exited. You identify yourself and he cooperates. Your supervisor is on the way. What should your notebook notes include?",
            "part2_choices": [
                ("The time, location, a factual description of what you observed on camera, his behaviour, and your actions — no opinions.", True, "Correct. The manual states notes must record facts, not opinions or conclusions. Write what you observed, not what you think about the person."),
                ("Your opinion that he is a repeat offender and seemed nervous, plus the camera reference.", False, "Incorrect. The manual says do not write opinions or conclusions that cannot be proven. Stick to factual observations only."),
                ("A brief summary now and a full detailed account later from memory once you are less stressed.", False, "Incorrect. The manual says notes must be made at the time events occur — not reconstructed later from memory, which is less accurate."),
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
            "title": "Scene preservation: evidence rules on criminal activity",
            "part1_prompt": "The manual has a specific rule about what to do when you find evidence of criminal activity during a patrol. What does it say?",
            "part1_choices": [
                ("Notify the police immediately and take care not to displace or destroy any evidence.", True, "Correct. The manual states exactly: 'If you see evidence of a break-in or other criminal activity, notify the police immediately; document your findings and take care not to displace or destroy evidence.'"),
                ("Document everything and clean up the scene so it is safe before police arrive.", False, "Incorrect. Cleaning up is exactly what the manual prohibits — you must not displace or destroy evidence. Preserve the scene as found."),
                ("Pick up identifiable items like the spray cans as evidence to hand to police when they arrive.", False, "Incorrect. Touching and moving items is displacing evidence, which the manual explicitly warns against. Leave everything in place and let police process the scene."),
            ],
            "part2_prompt": "Police have been called and are 10 minutes away. What should you do while you wait at the scene?",
            "part2_choices": [
                ("Secure the perimeter to stop anyone else from entering, and write a detailed factual account of exactly what you found and when.", True, "Correct. Scene security and contemporaneous notes are both required. Your written record of what you found — before police arrive — is valuable evidence."),
                ("Start photographing and then post the images online so administration can see what happened overnight.", False, "Incorrect. The manual says photos or video obtained during an investigation must not be released to media or posted on social networking sites."),
                ("Wait until after you speak with police to write your notes, so you can include what they tell you.", False, "Incorrect. Notes must record what you personally observed at the time. Write them immediately — before your memory fades and before talking to others."),
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
            "title": "Trespass: Petty Trespass Act and escalation steps",
            "part1_prompt": "Under the Alberta Petty Trespass Act, what is a person required to do when directed to leave by a security officer authorized by the owner?",
            "part1_choices": [
                ("Leave immediately after being directed — there is no right to stay and argue once told to leave.", True, "Correct. The Petty Trespass Act states a person 'does not leave land immediately after he or she is directed to do so by the owner or occupier or a person authorized by them' is guilty of an offence. Immediate compliance is required."),
                ("They have the right to ask for a written notice before they are required to leave.", False, "Incorrect. The Petty Trespass Act requires the person to leave immediately after a verbal direction from an authorized person. No written notice is required for this obligation to apply."),
                ("They may stay if they can provide a reasonable explanation for their presence.", False, "Incorrect. Once directed to leave by an authorized person, the person must leave immediately under the Petty Trespass Act. Their reason for being there is not a defence."),
            ],
            "part2_prompt": "He still refuses to leave after two verbal directions. The manual describes an escalation process for persistent non-compliance. What is the correct next step?",
            "part2_choices": [
                ("Call your supervisor or designated contact for direction, document the encounter, and if he continues, advise him you will treat this as a trespass requiring police.", True, "Correct. The manual says if an individual is persistent and keeps you from your duties, call your supervisor. If they still will not leave, advise them you will treat the incident as trespassing and involve police."),
                ("Physically force him off the property yourself since the Trespass Act gives you full authority to remove him.", False, "Incorrect. The Petty Trespass Act does not give security guards the right to physically drag a person off property. Police involvement is the required escalation."),
                ("Do nothing further since you have already given two warnings and your authority is exhausted.", False, "Incorrect. The manual is clear — if a person is persistent, you escalate to your supervisor and then to police. Walking away abandons your post and duty."),
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
            "part2_prompt": "Your supervisor asks you to document what happened. The manual has specific rules about what belongs in a security notebook. Which entry follows those rules correctly?",
            "part2_choices": [
                ("'Arrived 1900. Post unoccupied. Log shows last entry 1826 by Guard Smith. No note left. Notified Supervisor Davis at 1902. Assumed post 1902.' — factual, time-stamped, no opinion.", True, "Correct. The manual says notebook entries must record facts — who, what, where, when — with no opinions or conclusions. This entry does exactly that. The manual also says do not write anything you would not want your employer, the police, or the court to read."),
                ("'Guard Smith clearly abandoned the post and is not suited for this job. I arrived at 1900 and had to clean up his mess again.'", False, "Incorrect. The manual explicitly says do not write opinions or conclusions that cannot be proven. Writing that someone 'is not suited for the job' is an opinion that does not belong in a security notebook."),
                ("'Post was empty when I arrived. I took over and everything is fine now.' — brief but covers the basics.", False, "Incorrect. This entry omits key details the manual requires: exact times, log entry references, and supervisory notification. Brief notes that leave out facts are not sufficient for accountability or legal purposes."),
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
