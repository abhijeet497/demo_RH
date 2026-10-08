-- Create view for distinct entity names per framework
CREATE OR REPLACE VIEW risk_framework_agent_names AS
SELECT DISTINCT 
  rbs.name,
  rfr.framework_id,
  rbs.plan
FROM risk_baseline_scores rbs
INNER JOIN risk_framework_rules rfr ON rbs.rule_id = rfr.id
WHERE rfr.implementation_status IS NOT NULL;