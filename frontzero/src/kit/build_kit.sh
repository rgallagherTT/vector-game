#!/bin/sh
# Rebuild frontzero/design/m from the unzipped asset kit.  usage: build_kit.sh <kit-root containing design/> <out dir>
A="$1"; O="$2"; HERE=$(dirname "$0"); T=$O/m/tex; mkdir -p $O/m
f(){ src=$(ls $A/design/$1.glb 2>/dev/null | head -1); [ -n "$src" ] && python3 -I $HERE/slim.py "$src" "$O/m/$2.glb" $T "$3"; }
for w in ar7_talon kestrel9 mandate_m4x corsair hammerline vigil_dmr_l wasp ripcord hush bulwark grindstone sightline paladin longreach crowfeather anvil50 breacher stampede p9_sentry hatchet flicker rampart skyhook lancer; do f weapons/$w w_$w; done
for a in optic_red_dot optic_holo optic_3x optic_8x optic_thermal muzzle_suppressor muzzle_compensator muzzle_flash_hider grip_vertical grip_angled side_laser side_light; do f weapons/attachments/$a a_$a; done
for t in frag_grenade smoke_grenade flashbang emp_grenade c4_charge knife; do f weapons/throwables/$t t_$t; done
for v in hover_tank apc scout_buggy hover_bike vtol_gunship transport_vtol fighter attack_drone; do f vehicles/$v v_$v; done
for v in missile_air tank_shell; do f vehicles/munitions/$v x_$v; done
f characters/soldiers/soldiers_accord kit_accord accord_body_01_LOD1,head_01,head_03,helmet_01,vest_01,pack_01
f characters/soldiers/soldiers_mandate kit_mandate mandate_body_01_LOD1,head_01,helmet_02,vest_02,pack_01
for o in kestrel ironside rivet bastion mercy6 quartermaster wren ghost; do f characters/operators/$o op_$o; done
for g in ironside_shield_wall bastion_sentry_turret rivet_sticky_mine mercy6_healing_drone quartermaster_ammo_crate wren_recon_drone bastion_cover_medium; do f characters/gadgets/$g g_$g; done
f characters/bosses/boss_warden b_boss_warden; f characters/bosses/boss_viper b_boss_viper; f characters/bosses/boss_matriarch b_boss_matriarch body,headgear,armour_vest,tablet
for l in crate_common crate_uncommon crate_rare crate_epic crate_legendary supply_drop ammo_box medkit armour_plate cash_stack intel_drive dog_tags weapon_case; do f loot/$l l_$l; done
for p in capture_flag sandbag_wall hesco_barrier concrete_barrier shipping_container fuel_drum street_light radio_tower watchtower wrecked_car; do f world/props/$p p_$p; done
for p in hq_tent helipad vehicle_bay barracks generator command_table armory_rack; do f base/$p base_$p; done
