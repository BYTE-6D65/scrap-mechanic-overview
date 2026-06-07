-- ============================================================================
-- sm_overview export block  (for Scrap Mechanic 0.6.6 and later, incl. 0.7.x)
-- ============================================================================
-- Scrap Mechanic 0.6.6 blocked sm.json.save from writing to arbitrary paths,
-- so the world data is dumped to the game log instead and extracted afterwards.
--
-- WHERE TO PASTE THIS:
--   In your game's  .../Survival/Scripts/terrain/terrain_overworld.lua
--   inside the Load() function, in the  if sm.terrainData.exists() then  block,
--   PASTE THIS ENTIRE BLOCK immediately AFTER the line:   CreateCellTileStorageKeys()
--   and BEFORE the line:                                    return true
--
-- ALSO REQUIRED (step 2a): replace your game's
--   .../Survival/Scripts/terrain/overworld/tile_database.lua
--   with the included game-patches/tile_database.lua  (adds GetLegacyID).
--
-- SAFETY: the block runs once per session and is wrapped in pcall(), so even
-- if something goes wrong it logs an error and never breaks your game's load.
-- ============================================================================

		-- === sm_overview export (0.6.6+ workaround: dump cells.json to the game log) ===
		local _ok, _err = pcall( function()
			local already = sm.terrainGeneration.getTempData( "STORAGE_CELLJSON" ) or false
			if already == false then
				local cells = {}
				forEveryCell( function( cellX, cellY )
					local cell = {}
					cell["x"] = cellX
					cell["y"] = cellY
					cell["tileid"] = GetLegacyID( GetCellTileUid( cellX, cellY ) )
					cell["flags"] = g_cellData.flags[cellY][cellX]
					cell["rotation"] = g_cellData.rotation[cellY][cellX]
					cells[#cells+1] = cell
				end )
				if #cells > 0 then
					cells[1]["bounds"] = g_cellData.bounds
					cells[1]["seed"] = g_cellData.seed
					sm.log.info( "--- START COPYING AFTER THIS LINE FOR CELLS.JSON ---" )
					local json = sm.json.writeJsonString( cells )
					sm.log.info( json )
					sm.log.info( "--- STOP COPYING BEFORE THIS LINE FOR CELLS.JSON ---" )
					cells = nil
					json = nil
					sm.terrainGeneration.setTempData( "STORAGE_CELLJSON", true )
				end
			end
		end )
		if not _ok then sm.log.info( "sm_overview export error: "..tostring( _err ) ) end
		-- === end sm_overview export ===
