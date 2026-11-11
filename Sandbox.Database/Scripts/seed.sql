-- Generated for the sandbox from the LT Info Monitoring Dashboard's programs.json and the
-- public LT Info API (program descriptions, monitoring approach, and partners).
-- Rerun the generator to refresh; do not hand-edit.
SET NOCOUNT ON;

INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (1, N'Air Quality', N'air-quality', N'#9CC3EA', 10);
INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (2, N'Fisheries', N'fisheries', N'#B94F41', 20);
INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (3, N'Recreation', N'recreation', N'#F78814', 30);
INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (4, N'Scenic Resources', N'scenic-resources', N'#B0A843', 40);
INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (5, N'Soil Conservation', N'soil-conservation', N'#9A5710', 50);
INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (6, N'Vegetation Preservation', N'vegetation-preservation', N'#415414', 60);
INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (7, N'Water Quality', N'water-quality', N'#0F3F6F', 70);
INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (8, N'Wildlife', N'wildlife', N'#9E2220', 80);
INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (9, N'Noise', N'noise', N'#675EA1', 90);
INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder) VALUES (10, N'Transportation and Sustainable Communities', N'transportation-and-sustainable-communities', N'#DB5B00', 100);

INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (41, N'Ozone (O3)', 1, NULL, N'Ozone is monitored at a number of locations around the Lake Tahoe Basin

through the years by a variety of partners. Data is collected, analysed, and reported by the respective agency.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (26, N'Carbon Monoxide (CO)', 1, NULL, N'Between 1983 and 1998, CO was monitored at the Horizon Hotel in Stateline, Nevada. In 1999, the monitoring site was relocated to Harvey’s Resort parking garage in Stateline, Nevada. The site is located to monitor the highest CO concentrations in the Lake Tahoe Basin because historically this area received the highest traffic volume, and is intended to be representative of both the California and Nevada sides of the South Shore Resort District. NDEP successfully petitioned the EPA to remove this monitoring site on June 30, 2012 because of the continued compliance with established CO concentration standards. CARB provided TRPA with a CO monitor which was installed on the roof of the TRPA building in Stateline, NV in 2013.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (42, N'Oxides of Nitrogen (NOX)', 1, N'The California emission inventory contains information on the following air pollution sources:

Stationary sources - approximately 13,000 individual facilities defined as point sources. Point sources are fixed pollution sources such as electric power plants and refineries.

Area-wide sources - approximately 80 source categories. An area-wide source category is made up of sources of pollution mainly linked to human activity. Examples of these sources include consumer products and architectural coatings used in a region

Mobile sources - all on-road vehicles such as automobiles and trucks; off-road vehicles such as trains, ships, aircraft; and farm equipment

The principal agencies contributing data to the stationary and area-wide source inventory are the CARB and the California air pollution control and air quality management districts. The CARB, the California Department of Transportation (Caltrans), and regional transportation agencies are the principal agencies involved in developing the mobile source inventory. Information represented in the California

emission inventory is a snap-shot of a variety of dynamic and variable processes. As such, the emission inventory can only represent an estimate of what is actually occurring. In summer 2011, a new NOx monitoring station was installed at the TRPA offices in Stateline, Nevada. Data from 2013 and 2014 for this site are now available.', N'CARB compiles data to create the criteria pollutant emission inventory, which

includes information on the emissions of reactive organic gases (ROG), oxides of nitrogen (NOx), oxides of sulfur (SOx), carbon monoxide (CO), and particulate matter (PM10). Data are gathered continuously and stored in the California Emission Inventory Development and Reporting System (CEIDARS). A summary of the criteria pollutant inventory is published annually.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (46, N'Particulate Matter 2.5', 1, NULL, N'Particulate matter is monitored by Placer County in Tahoe City, and at LTCC and DL Bliss as part of the national IMPROVE national monitoring network.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (45, N'Particulate Matter 10', 1, NULL, N'Particulate matter is monitored in the Tahoe Basin by the California Air Resources Board at South Lake Tahoe, and is monitored as part of the national IMPROVE network sites at LTCC and DL Bliss State Park.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (63, N'Stream Bioassessment and Physical Habitat', 2, N'TRPA began monitoring perennial streams in 2009 to determine if TRPA thresholds for stream habitat are being met, and to detect changes in the overall condition of the Tahoe Basin''s streams. Bioassessment, which uses benthic macroinvertebrates (BMI) and physical stream habitat to assess overall stream health, is used to monitor the Basin''s streams. To obtain a stream health "score", the California Stream Condition Index (CSCI) is used. The CSCI is a model that compares the BMI found in sampled streams against the BMI expected to be found in pristine streams in the Sierra Nevada.

CSCI stream score greater than 0.92 = excellent health

CSCI stream score of 0.79 to 0.92 = good health

CSCI stream score of less than 0.79 = degraded health', N'TRPA''s stream monitoring program uses the Surface Water Ambient Monitoring Program bioassessment protocol, which measures Benthic Macroinvertebrate (BMI) composition and physical stream habitat to assess overall stream health. BMI composition and habitat is compared against pristine streams using the California Stream Condition Index to determine the biotic integrity of streams. Probabilistic and targeted sampling is used to assess the overall health of Tahoe streams, changes in stream health over time, and to assess large scale restoration and BMP implementation projects. 20 probabilistic, one-time "status" sites are sampled per year, as well as 73 "trend" sites re-visited every four years. Only trend sites are displayed on this page. Status site information can be found at EcoAtlas.org

To download all of the stream data on this page please see Tahoe Open Data.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (59, N'Scenic Monitoring', 4, NULL, N'Every four years, a team of professionals examines and evaluates the quality of

scenic units and resources along major roadways, the shoreline, and at certain public recreation sites and bike trails in the Lake Tahoe Region. The team also reviews ratings from prior evaluations and updates rating based on its findings.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (49, N'SEZ Basin-wide Monitoring and Assessment Plan', 5, N'The SEZ Basinwide Monitoring and Assessment Plan provides the methods and protocals to assess the current status and long-term trends of SEZs on a Basin-wide scale. The Plan will also provide a means to evaluate the impacts of ongoing and future management actions, identify regional impairments, and detect long-term trends that can inform sound future SEZ policy.', N'SEZ function is evaluated as a function of up to 10 indicators. Details on each indicator and monitoring methods are available in the plan.

Results from the program are compiled on the Lake Tahoe SEZ Viewer: https://gis.trpa.org/TahoeSEZViewer/', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (39, N'Tahoe Yellow Cress Monitoring', 6, N'Tahoe Yellow Cress (TYC, Rorippa subumbellata) is a small native plant that grows on the shoreline of Lake Tahoe and no where else in the world. It lives only on the sandy beaches and dunes at the ever-changing margin of the lake. Impacts from recreation and development first led to conservation concerns in the 1970’s and TYC has been listed as endangered in both states since 1982. In 1999, a multi-agency and private interest group task force was formed to develop and implement a conservation strategy to promote the recovery and conservation of TYC. The conservation strategy provides an adaptive management framework and options for avoiding, minimizing, and mitigating impacts to TYC and its habitat on public and private lands. The TYC Stewardship Program recognizes the critical role of private landowners in ensuring the long-term survival of TYC.

A similar species can be found growing alongside TYC on the shores of Lake Tahoe. TYC has plump round fruits, fleshy leaves, and a compact growth form, while western cress (Rorippa curvisiliqua) is often taller, the fruits are elongated and narrow, and the leaves are less fleshy and turn purple with age. In contrast to the rarity of TYC, western cress is very widespread throughout the western U.S.', N'Knowledge of TYC distribution has been developed through shorezone surveys since 1979. Before 2000, surveys followed a general protocol and were completed at various times during the summer. Since 2001, surveys are conducted the first week of September following a standardized protocol. During the first survey in 1979, 32 TYC sites were surveyed; this has since grown to 55 sites. A survey “site” is defined as a stretch of public beach, adjacent private parcels, or adjacent parcels under a combination of private and public ownership. Surveys include stem count estimates as a measure of TYC abundance because clonal growth makes it impossible to distinguish individuals. The amount of available shorezone habitat for TYC fluctuates widely with changes in lake level, with high lake levels leaving little habitat. On average, over 70% of surveyed sites are occupied when the lake is below 6,225 ft. in September, but less than 40% are occupied when the lake level is above 6,228 ft.

To download all of the Tahoe yellow cress data on this page please see Tahoe Open Data.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (83, N'Subalpine Conifer', 6, N'A monitoring program to track the non-degradation of subalpine conifer species, including the endangered whitebark pine.', N'Ground-based plot data that inform remote sensing techniques to track change over time in species composition, health, and distribution in the subalpine zone.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (82, N'Harmful Algae Bloom (HAB) Monitoring', 7, N'What are Harmful Algal Blooms (HABs)?

Cyanobacteria are small microbes or bacteria that live in nearly every habitat on land and in the water. They have existed for billions of years as essential components of freshwater ecosystems and form the foundation of most aquatic food chains. When these organisms produce dangerous toxins, they are commonly referred to as harmful algal blooms or HABs.

When environmental conditions favor the growth of HABs and algae, such as warm temperatures and low or stagnant water flows, and excessive nutrient inputs, they can multiply rapidly creating nuisance blooms. Some HABs can produce toxins that can harm pets, wildlife, or people. Not all HABs produce toxins, but those that do can cause a multitude of health issues and even death. There are two types of HABs known as planktonic (HABs suspended in the water column) or benthic (HAB that grow attached to the bottom).

In the Lake Tahoe Basin, harmful algal blooms are most common during the warm weather months between late May through October, but they can occur all year.

The first known harmful algal bloom (HAB) occurred in the Lake Tahoe Keys in August 2017. The level of measured cyanotoxins was below any health concern, but the area was posted to warn the public of the potential danger and to protect pets. The Lahontan Water Board monitors the California side of the Lake Tahoe Basin for HAB issues and responds to reports of possible HABs by sampling the lake and posting results as appropriate. For HABs on the Nevada side of the Basin, the Nevada Department of Environmental Protection (NDEP) is the lead agency.

Read about the Water Board''s HAB response on the California side of the Lake Tahoe Basin.

Read about NDEP''s HAB response on the Nevada side of the Lake Tahoe Basin.

For information about the most recent HAB advisories in California (including the California side of Lake Tahoe), visit this web map.', N'On the California side of the lake, water samples are collected and tested for the presence of HABs and their associated toxins at various locations. Water Board staff respond to new bloom reports, and also administer a pre-holiday assessment monitoring program at several California beaches. HAB monitoring associated with pre-holiday assessments is intended to collect information to inform the public in California about the safety of recreational beaches during high use holiday weekends including Memorial Day, Fourth of July, and Labor Day.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (15, N'LTIMP', 7, NULL, N'The Lake Tahoe Interagency Monitoring Program (LTIMP) stream monitoring program was first developed in 1979 to assess sediment and nutrient input from tributaries to Lake Tahoe, and to support research that aims to understand the drivers affecting the transparency of Lake Tahoe. The tributary monitoring focuses on both event-based conditions (large runoff events associated with rainfall and snowmelt) and baseline conditions (low inflow during summer when precipitation is negligible). Up to 10 streams have been monitored since the early 1990s; five in California (Upper Truckee River, and Trout, General, Blackwood and Ward Creeks) and five in Nevada (Third, Incline, Glenbrook, Logan House, and Edgewood Creeks). Six of these streams have been monitored since water years 1980 or 1981. In water year 2012 the number of streams routinely monitored was reduced to seven (see map above), and all streams have primary monitoring stations at or near the point of discharge to Lake Tahoe. Sampling pr', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (76, N'Nearshore Human Health, E. coli Monitoring', 7, N'The Nearshore Human Health monitoring program collects Escherichia Coli (E. coli) samples to help resource managers ensure Lake Tahoe’s waters remain safe for public recreation. Water quality samples are collected between June and September at many beaches around the lake. More information about the sampling program are available here. A safe to swim map depicting recently collected E. coli data is available here.', N'Water quality samples for E. coli are taken throughout the summer at popular beaches around Lake Tahoe. E. coli is an indicator of the presence of harmful pathogens or viruses associated with recent contamination by wastewater or other fecal contamination. Individuals who swim in or contact water with elevated levels of E. coli may be at risk of getting sick because of potential exposure to harmful pathogens or viruses associated with wastewater or other fecal contamination.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (66, N'Pelagic Water Quality (Clarity)', 7, N'Lake clarity measurements have been taken continuously by UC Davis Tahoe Environmental Research Center (TERC) since 1968, when a white disk, called the Secchi disk, could be seen down to 102 feet. It is one of the longest, unbroken clarity records in the world. Secchi depth is the most widely used method of clarity measurement, and the values are consistent with laser-based measurements also taken by TERC researchers. Water transparency in Lake Tahoe is controlled by fine particles blocking light penetration either by scattering or by absorption. The decline in transparency is the result of accumplation of fine sediment particles and growth of small phytoplankton (algae). Fine sediments and nutirents are transporated to the lake by stormwater runoff, stream erosion, and through atmospheric deposition.', N'Measurements are taken in Lake Tahoe using a 25 centimeter, all white Secchi disk. The disk is lowered into the water column from a boat to a depth at which it is no longer visible by the observer, and then raised slowly until visible again. The midpoint of these two depths is called the Secchi depth. Between 18 and 37 individual Secchi depth measurements have been collected each year at an established index station.

To download all of the water clarity data on this page please see Tahoe Open Data.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (13, N'Periphyton', 7, NULL, N'UC Davis has monitored periphyton in Lake Tahoe since 2000. Monitoring also occurred between 1982 and 1985 and 1989 to 1993. The primary periphyton monitoring work are regular sampling work referred to “routine” sampling at nine sites annually (the number of locations has varied historically from six to ten). At each location algal biomass (as chlorophyll a) is sampled five times annually from natural rock surfaces at a depth of 0.5 meters below the water level at the time of sampling. A second type of sampling, referred to a “synoptic” monitoring occurs once a year at 40 additional sites. The timing of synoptic monitoring varies annually and is intended to capture biomass at its peak in the spring. The synoptic monitoring includes collection of chlorophyll a at a sub-set of the sites, as well as a rapid assessment method that quantifies a periphyton biomass index (PBI).', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (16, N'Regional Stormwater Monitoring', 7, N'The Tahoe Resource Conservation District (Tahoe RCD) is leading the effort to measure pollutants in urban runoff at Lake Tahoe to help evaluate the combined effectiveness of pollutant control measures and consistently track and report monitoring findings. This effort, known as the Regional Storm Water Monitoring Program (RSWMP) is a collaborative program supported by regulatory agencies, local government representatives, and scientists in the Lake Tahoe region.

The RSWMP Data Management System (DMS) was created for Tahoe RCD by the Desert Research Institute (DRI) and Geosyntec. The DMS retrieves and analyzes stormwater monitoring data to evaluate effectiveness of regional stormwater management strategies. That monitoring data is automatically retrieved from the DMS and displayed in LT Info. This page can be used to explore and understand the RSWMP monitoring program and select monitoring data.

Funding for RSWMP implementation, DMS development, and display on LT Info was provided by the California State Water Resources Control Board.', N'Monitoring is guided by the RSWMP Framework and Implementation Guidance document. During water year 2014 five catchments were monitored for continuous flow and turbidity and sampled for water quality at eleven monitoring stations: the outfalls of the five selected catchments, and the inflows to and outflows from selected BMPs located in three of those catchments. Three additional catchment outfalls were monitored in water year 2015. The catchments were chosen because of their direct hydrologic connectivity to Lake Tahoe, diversity of urban land uses, range of sizes, and a reasonably equitable distribution among the participating jurisdictions. BMP effectiveness sites were selected because of their potential efficacy in treating storm water runoff characteristic of the Lake Tahoe Basin, and the broad interest in, and lack of conclusive data regarding the efficiency of the selected BMPs in reducing runoff volumes and pollutant loads.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (12, N'Nearshore Turbidity Monitoring', 7, NULL, N'A pilot monitoring program of nearshore turbidity began with the first circuit completed in November 2014, followed by similar nearshore circuits completed in April, June, August and November 2015. Measurements were made at a depth of seven meters. Routine boat operating speeds are typically around 10 kilometers per hour in the nearshore areas (Heyvaert et al., 2016). Beginning 1991, nearshore turbidity was measured offshore at the 25-meter depth contour for several locations, including 1) mouth of Upper Truckee River and Trout Creek; 2) El Dorado Beach; 3) mouth of Edgewood Creek; 4) Nevada Beach; 5) mouth of Incline Creek; 6) Burnt Cedar Beach; 7) mouth of Ward Creek; 8) Tahoe State Recreation Area; and 9) the mouth of Blackwood Creek. More recently, nearshore clarity has been measured at approximately the seven-meter contour following a continuous circuit around the lakeshore. This strategy is considered more representative of littoral conditions where people interact with the lake', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (14, N'Aquatic Invasive Plants', 7, NULL, N'Monthly veliger surveys for mussel larvae are done during the boating season.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (9093, N'Watercraft Inspections', 7, N'Watercraft inspected for aquatic invasive species before launching at Lake Tahoe each year, how many needed decontamination, and where the inspection stations are.', NULL, 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (78, N'Aquatic Plant Survey Zones', 7, N'The Aquatic Plant Monitoring Program (APMP) is intended to gather, analyze, and report information relative to aquatic plant populations in Lake Tahoe, with an emphasis on collecting data that can be used to guide control efforts for aquatic invasive plant', N'Two levels of aquatic plant survey effort (spatial design) are applied to the APMP and each is performed on a different temporal scale. Once every five years a nearshore-wide aquatic plant survey is conducted via interpretation and mapping of remotely sensed data in combination with in situ diver sampling. Annually, only an in situ diver survey (or a reasonable surrogate) is performed following targeted and a stratified systematic sampling of transect lines with incorporated quadrats. The nearshore-wide aquatic plant survey (i.e., the combination of remote sensing imagery analysis with diver surveys) attempts to provide for a “baseline” status quantification of all aquatic plant beds around Lake Tahoe’s nearshore zone. The transect surveys allows for training and validation of remotely sensed data, and annual surveillance to establish trend information and the detection of new infestations of aquatic invasive plants. The sampling frame (i.e., survey area) and habitat stratification scheme used for line-transect surveys conducted in intervening years will be the same as that used for the nearshore-wide survey. Four habitat strata are used to divide the aquatic plant population into meaningful sampling units, including open-water nearshore, marshes, major tributaries, and marinas and embayments.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (9034, N'Submerged Aquatic Vegetation', 7, N'Mapped patches of targeted submerged aquatic vegetation in Lake Tahoe.', NULL, 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (2, N'Osprey', 8, NULL, N'A shoreline survey is conducted by boat monthly during spring and summer months following standard protocols. Additional surveys are conducted at historic and likely nest sites at other lakes and upland areas. All suitable nesting habitat is surveyed for nest activity and nest success.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (4, N'Bald Eagle', 8, NULL, N'Known nest sites are visited regularly during the incubation and fledging periods to determine reproductive success. Monthly boat surveys during non-winter months are conducted to identify any new nest sites surrounding Lake Tahoe, and ad-hoc surveys are conducted in other areas in support of environmental assessments for proposed projects.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (6, N'Peregrine Falcon', 8, NULL, N'Biologists observe historic or potential nest sites for a minimum of four hours per month, April through August following standard U.S. Forest Service protocol. All potential nesting habitat is surveyed and incidental sighting are used to help focus monitoring efforts.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (29, N'Northern Goshawk', 8, NULL, N'Portions of known and potential northern goshawk habitat are surveyed following well-accepted protocols including a combination of dawn acoustic surveys, stand search surveys, and broadcast surveys. Recent survey work has been conducted in response to proposed projects and has been primarily focused at assessment of project level impacts, not assessment of population status and trends in the Tahoe Basin. The last full population survey was completed in 2010.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (7, N'Waterfowl', 8, NULL, N'The methodologies and indicators used by TRPA to evaluate the attainment status of the waterfowl standard has varied over time. The 2001 Threshold Evaluation Report used observed bird species richness and diversity along with the human activity rating system to gage threshold standard attainment status (TRPA 2001). The 2006 Threshold Evaluation Report used observation of bird species richness and diversity as well as an assessment of detrimental or non-native species, but did not use the human disturbance rating system that was used in 2001. The 2011 Threshold Evaluation Report used only a human disturbance rating system as a means to measure status (TRPA 2012a). Since 2015, the assessment method used is based on field observations and human activity levels at mapped waterfowl population sites, similar to the 2011 Threshold Evaluation Report methods. No formal waterfowl surveys were conducted. Each site was visited by a qualified observor to conduct the human disturbance rating evaluation.', 0);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (65, N'Noise - Highways', 9, N'TRPA regularly monitors noise along highway corridors in the Lake Tahoe Basin to ensure noise limits are not being exceeded. Because noise from highways is the largest source of background noise in the Basin, noise limits near highways ensures the serenity of the Tahoe Basin is maintained. High noise levels can reduce the public’s enjoyment of the natural environment, impact quality of life for residents, and disturb native wildlife.

Recommended CNEL levels for transportation corridors were developed as part of the 2012 Regional Plan Update. CNEL thresholds will be attained upon implementation of the following policy:

Transmission of Noise from the Transportation Corridors Shall be Reduced. The noise associated with the transportation corridors can be decreased by reducing the number of trips and by installing mitigation measures. Trip reduction will be accomplished by the transit improvements identified in the Transportation Element (of the Regional Plan). Ordinances will establish specific site design criteria for projects to help reduce the transmission of noise from the transportation corridors. The design criteria will also be incorporated into the water quality and transportation improvement programs. The mitigation measures may include setbacks, earth berms, and barriers.

The data from this monitoring program informs the need for specific design criteria and mitigations measures as written in section 68.8.3 in the TRPA Code of Ordinances.', N'TRPA uses a Community Noise Equivalent Level (CNEL) meaure to assess whether noise levels are being exceeded in highway corridors. The CNEL averages decible (dB) levels over a 24 hour period, with excess noise late at night and early in the morning being weighted greater due to humans and wildlife being more sensitive to noise at these times.The highest 24-hour CNEL measured is used to assess noise levels. TRPA regularly monitors noise along highway corridors at 30 locations around the Tahoe Basin, with monitors located 300 feet from the edge of the highway. Noise monitors are deployed for 1-2 weeks during the peak highway useage period, which is generally July 4th through Labor Day. Each noise monitoring location is re-visited once every four years. Noise monitors are calibrated to industry standards to ensure accuracy.

The following CNEL noise limits are in place for highways in the Tahoe Basin:

Highway 207 (Kingsbury Grade) = 55 dB (blue)

Highway 431 (Mt Rose Highway) = 55 dB (yellow)

Highway 89 = 55 dB (orange)

Highway 28 = 55 dB (red)

Highway 50 = 65 dB (brown)

To download all of the highway noise data on this page please see Tahoe Open Data.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (61, N'Noise - Plan Areas', 9, N'TRPA monitors background noise levels in all Plan Areas in the Tahoe Basin to ensure noise levels are not disturbing people and wildlife, and to maintain the unique characteristics of the Basin. Each Plan Area has its own allowable noise level in TRPA''s thresholds, with maximum average 24-hour allowable noise levels ranging from 45 decibles (dB) in wilderness areas to 65 dB in industrial areas. High noise levels can reduce the public’s enjoyment of the natural environment, impact quality of life for residents, and disturb native wildlife.

Data found in this monitoring dashboard informs evaluation of TRPA thresholds for allowable community noise levels and evaluation of initial environmental checklists as part of the TRPA project review process written in section 68.8.1 in the TRPA Code of Ordinances.', N'TRPA uses a Community Noise Equivalent Level (CNEL) meaure to assess whether noise levels are being exceeded in Plan Areas. The CNEL averages decible levels over a 24 hour period, with excess noise late at night and early in the morning being weighted greater due to humans and wildlife being more sensitive to noise at these times. Noise monitors are generally put out in Plan Areas for 1-2 weeks during peak noise periods (generally summer). The average 24-hour CNEL measured is used to assess noise levels. Construction noise or other unusual noise events are excluded from the data. Noise monitors are calibrated and tested to noise industry standards to ensure proper measurements. TRPA monitors each of the 9 Plan Area types per year.

In general, the following CNEL noise levels are allowed in different land use categroies:

Wilderness and roadless areas = 45 dB

Low density residential areas = 50 dB

Rural outdoor recreation areas = 50 dB

High density residential areas = 55 dB

Urban outdoor recreation areas = 55 dB

Commercial areas = 60 dB

Hotel / motel areas = 60 dB

Industrial areas = 65 dB

Critical Wildlife Habitat = 45dB', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (62, N'Noise - Shorezone', 9, N'TRPA regularly monitors noise from motorized watercraft in the shorezone of Lake Tahoe to ensure noise levels are not being exceeded. Shorezone noise limits are in place to maintain the serenity of Lake Tahoe and to protect sensitive wildlife.', N'TRPA regulalry monitors noise in the shorezone from motorized watercraft at up to ten locations around Lake Tahoe. Noise monitors are deployed for at least two weeks during peak boating season which occurs July 4th to Labor Day. Noise monitors automatically record all single noise events that exceed 75 decibles (dB), the noise limit for shorezone areas. Afterward, all noise events exceeding 75 dB are listened to by a noise technician to distinguish noise exceedancs from watercraft and non-watercraft. Noise monitors are regularly calibrated to industry standards to ensure accuracy.

To download all of the shoreline noise data on this page please see Tahoe Open Data.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (33, N'Bicycle and Pedestrian', 10, N'TRPA and local partners monitor bicycle and pedestrian activity throughout the Region to understand high use areas, mode-split, and support grant applications and reporting. Count information also informs policies and programs targeted to improve and support active transportation.', N'In 2015, as part of the update to the Active Transportation Plan, TRPA developed the Lake Tahoe Region Bicycle and Pedestrian Monitoring Protocol using best industry practices and national experts Kittleson & Associates. TRPA began implementation in summer of 2015, which built on and integrated previous monitoring efforts. In partnership with local agencies, TRPA has established a system for the collection of year-round active transportation data which includes permanent counting stations, biennial count locations, and spot count locations depending on need. During the first two years of implementation, TRPA produced a bicycle and pedestrian monitoring report which analyzes historical trends, provides detailed information by location, and compares use at similar sites. This report also supplemented the regional transportation monitoring report. Moving forward, all analysis and up-to-date data will be available on the transportation monitoring dashboard, in lieu of a hardcopy report.

To download all Bicycle & Pedestrian data please visit Tahoe Open Data.

Map Legend:

Permanent Monitors-Green

Trend Monitors (every other year data)- Brown

Pneumatic Tubes (only 1 week of data at a time)- Blue

Retired Monitors or Short- term monitoring- Gray', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (77, N'Congestion-Travel Time', 10, N'TRPA monitors congestion on roadways throughout the region to assist with regional transportation planning. A well executed transportation management system incorporates monitoring data, real-time information, and dynamic operations that respond to seasonal congestion and periodic congestion.', N'Congestion can be characterized by many metrics and sourced from a variety of different data sources. For the purpose of analyzing congestion in the Tahoe region, TRPA uses the Regional Integrated Transportation Information System (RITIS) probe data analytics suite, provided by the Federal Highway Administration.

The data presented is median observed travel time in minutes for travel in both directions for the segment. The median is the midpoint of how long it took travelers to travel the length of the segment; 50% of trips were faster than this time and 50% were slower.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (34, N'Safety', 10, N'Safety is a regional transportation plan goal and policy because it is critical that everyone feel comfortable traveling at Lake Tahoe, whether they are walking, taking the bus, riding a bike or driving a car. Safety is not only an important goal for Tahoe, the Federal Highway Administration (FHWA) recently established five safety performance measures. FHWA Safety (PM 1) Final Rule, effective April 14, 2016, supported the data-driven performance focus of the Highway Safety Improvement Program and established performance measures for which states and Metropolitan Planning Organizations must develop targets.', N'Safety performance measures help to assess fatalities and serious injury on all public roads regardless of ownership or functional classification. These measures are required to be incorporated into the regional transportation plan and state’s Highway Safety Improvement Programs. To support meeting these targets, a Lake Tahoe Region Safety Plan is underdevelopment which outlines crash trends, risk factors, gaps in data, and recommends strategies and designs to improve safety for all roadway users. Crash data is provided by the state of California and Nevada and consolidated by TRPA.

To download crash data please visit Tahoe Open Data.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (68, N'Socio-Economic', 10, N'TRPA monitors socio-economic data for a variety of purposes, including regional transportation planning, development rights, travel demand modeling, and sustainability. The U.S. Census Bureau is one important source of socioeconomic and demographic data.', N'The U.S. Census Bureau collects and distributes data under a handful of different programs. Two of the more commonly used programs are the Decennial Census and the American Community Survey (ACS). The Decennial Census is a definite source of demographic data but only is collected every ten years; it includes a limited number of variables such as number of households and total population. The ACS is a program that provides data estimates on a one, three, and five year timeline; ACS data is collected more frequently but the data estimates have a margin of error that must considered because the data is taken from a small sample of the total population. The ACS includes many more variables compared to the Decennial Census that relate to transportation, income, and housing. Both the Decennial and ACS datasets have similiar data structures. Each row in both datasets include a particular variable and a number the indicates the total number of households or persons that characterize that variable.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (64, N'Traffic Volumes', 10, N'In partnership with the state DOTs, TRPA collects, monitors, and analyzes roadway traffic volume data from several dozen count stations throughout the Tahoe region.', N'Traffic volume monitoring is part of a regional strategy to create a well executed transportation management system that incorporates monitoring data, real-time information, and dynamic operations that respond to seasonal and periodic congestion. Over the last few years, intelligent transportation systems have seen significant advancements and deployments in the areas of data collection, data sharing, mobile solutions, and traffic monitoring capabilities. Both the California Department of Transportation (Caltrans) and the Nevada Department of Transportation (NDOT) manage several dozen permanent traffic count stations, which collect data on the number of vehicles traveling throughout the region. TRPA aggregates and analyzes this data for a variety of purposes, including project planning, development of our Regional Transportation Plan, and travel demand modeling.

To download all of the traffic volume data on this page please see Tahoe Open Data.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (36, N'Transit', 10, N'TRPA conducts on-going monitoring to inform transportation policy and programs with the goal of providing a successful multi-modal transportation system that appeals to users, supports mobility needs, and decreases dependency on the private automobile. TRPA has been monitoring transportation performance since the early 1970s including traffic counts, travel mode choice, and demographic and air quality trends so that planners can evaluate the Lake Tahoe Region’s transportation system and use best available science to inform policy-making. The 2016 FAST Act requires states and MPOs to develop targets for specific performance measures related to safety, transit, and roadway/bridge conditions. To comply with FAST Act regulations, TRPA has prioritized identifying performance measures and setting targets for transit to help transit agencies improve the efficiency and effectiveness of the level of service they provide in Tahoe.', N'TTD, TRPA, and TART work together in corridor and transit planning. Consistent transit rider surveys and operations data collection help determine the need for additional services and operating hours. Based on reporting requirements, TRPA''s Productivity Improvement Program (PIP), and goals outlined in the Regional Transportation Plan, Long Range Transit Master Plan, and each transit agency''s Short Range Transit Plans, the Tahoe transit monitoring program is built to track the following: Deadhead Miles and Hours, Ridership, Transit Mode Share, Productivity, On Time Performance, Operating Cost, Farebox Recovery, Rolling Stock, Equipment, Facilities, and Infrastructure. To find out more about these performance measures, take a look at the Tahoe Transit Monitoring Program: Monitoring Protocol.', 1);
INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured) VALUES (69, N'Travel Behavior', 10, N'Since 2006 TRPA has conducted basin-wide travel surveys every two years in order to better understand basic travel characteristics of both residents and visitors. The data collected - which includes data points such as mode share, origin-destinations, and trip purpose - is used for a variety of purposes at TRPA including regional performance metrics, project planning, and travel demand modelling.', N'The dashboard below summarises TRPA''s 2018 Summer Travel Survey, which was conducted in late-August of 2018.', 1);

SET IDENTITY_INSERT dbo.Organization ON;
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (1, N'Tahoe Regional Planning Agency', N'TRPA');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (2, N'Desert Research Institute', N'DRI');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (3, N'U.S. Environmental Protection Agency', N'USEPA');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (4, N'California Air Resources Board', N'CARB');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (5, N'Washoe County Air Quality Management Division', N'WCAQ');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (6, N'Placer County Air Pollution Control District', N'PCAPCD');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (7, N'California Lahontan Regional Water Quality Control Board', N'Lahontan');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (8, N'Nevada Division of Environmental Protection', N'NDEP');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (9, N'California Department of Fish & Wildlife', N'CDFW');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (10, N'League to Save Lake Tahoe', N'League');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (11, N'Nevada Tahoe Resource Team – Nevada Division of Forestry', N'NDF');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (12, N'Nevada Tahoe Resource Team – Nevada Division of State Parks', N'NV State Parks');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (13, N'Nevada Tahoe Resource Team – Nevada Division of State Lands', N'NDSL');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (14, N'California State Lands Commission', N'California SLC');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (15, N'California Tahoe Conservancy', N'CTC');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (16, N'U.S. Forest Service - Lake Tahoe Basin Management Unit', N'USFS - LTBMU');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (17, N'California Department of Parks and Recreation', N'CDPR');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (18, N'U.S. Fish and Wildlife Service', N'USFWS');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (19, N'Nevada Natural Heritage Program', N'NNHP');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (20, N'Tahoe Lakefront Owners Association', N'TLOA');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (21, N'U.S. Bureau of Reclamation', N'USBOR');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (22, N'Nevada Tahoe Conservation District', N'NTCD');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (23, N'Tahoe Resource Conservation District', N'Tahoe RCD');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (24, N'Bureau of Land Management - Southern Nevada Public Land Management Act', N'BLM- SNPLMA ');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (25, N'U.S. Geological Survey', N'USGS');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (26, N'UC Davis Tahoe Environmental Research Center', N'TERC');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (27, N'City of South Lake Tahoe', N'CSLT');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (28, N'Douglas County, NV', N'DGCO');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (29, N'El Dorado County, CA', N'ELDO');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (30, N'Nevada Department of Transportation', N'NDOT');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (31, N'Placer County, CA', N'PLCO');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (32, N'Washoe County, NV', N'WACO');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (33, N'California Department of Transportation', N'Caltrans');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (34, N'Lake Tahoe Aquatic Invasive Species Coordination Committee', N'LTAISCC');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (35, N'Nevada Tahoe Resource Team – Nevada Department of Wildlife', N'NDOW');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (36, N'Tahoe Science Constortium', N'TSC');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (37, N'U.S. Department of Agriculture - Agricultural Research Service', N'USDA ARS');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (38, N'University of Nevada, Reno', N'UNR');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (39, N'Tahoe Institute for Natural Science', N'TINS');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (40, N'Tahoe City Public Utility District', N'TCPUD');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (41, N'Carson City County, NV', N'Carson');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (42, N'Tahoe Transportation District', N'TTD');
INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES (43, N'Tahoe Truckee Area Regional Transit', N'TART');
SET IDENTITY_INSERT dbo.Organization OFF;

INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (41, 1, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (41, 2, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (41, 3, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (41, 4, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (41, 5, 50);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (41, 6, 60);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (26, 2, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (26, 1, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (42, 1, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (42, 6, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (42, 2, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (42, 3, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (42, 5, 50);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (42, 4, 60);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (46, 6, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (46, 2, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (46, 1, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (45, 1, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (45, 2, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (45, 3, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (45, 4, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (63, 7, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (63, 8, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (63, 1, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (63, 9, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (59, 1, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 10, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 11, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 12, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 13, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 14, 50);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 9, 60);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 15, 70);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 16, 80);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 17, 90);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 1, 100);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 18, 110);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 19, 120);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 20, 130);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 21, 140);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 22, 150);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 23, 160);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (39, 24, 170);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (82, 7, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (82, 8, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (15, 7, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (15, 15, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (15, 13, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (15, 1, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (15, 16, 50);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (15, 25, 60);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (15, 26, 70);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (76, 7, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (76, 8, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (76, 1, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (76, 3, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (66, 1, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (66, 26, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (13, 7, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (13, 26, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 23, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 22, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 27, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 28, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 29, 50);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 30, 60);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 31, 70);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 32, 80);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 7, 90);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 8, 100);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (16, 33, 110);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (12, 2, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (12, 13, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (12, 26, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 9, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 17, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 7, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 14, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 15, 50);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 34, 60);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 10, 70);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 35, 80);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 13, 90);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 1, 100);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 23, 110);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 36, 120);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 37, 130);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 18, 140);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 16, 150);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (14, 38, 160);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (2, 17, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (2, 35, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (2, 1, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (2, 16, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (4, 17, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (4, 35, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (4, 1, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (4, 16, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (6, 15, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (6, 39, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (6, 35, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (6, 1, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (6, 16, 50);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (29, 35, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (29, 17, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (29, 16, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (29, 1, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (7, 15, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (7, 1, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (7, 16, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (65, 1, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (61, 1, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (62, 1, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (33, 40, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (33, 27, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (33, 28, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (33, 33, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (33, 30, 50);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (33, 31, 60);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (33, 29, 70);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (33, 1, 80);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (34, 33, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (34, 30, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (34, 27, 30);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (34, 28, 40);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (34, 31, 50);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (34, 32, 60);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (34, 41, 70);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (34, 29, 80);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (64, 30, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (64, 33, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (36, 42, 10);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (36, 43, 20);
INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES (36, 1, 30);
