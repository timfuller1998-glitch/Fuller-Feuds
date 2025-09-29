import CumulativeOpinion from '../CumulativeOpinion'

export default function CumulativeOpinionExample() {
  return (
    <div className="p-8 max-w-2xl">
      <CumulativeOpinion
        topicId="climate-change"
        summary="The discussion reveals a nuanced debate between individual responsibility and systemic change. While most participants acknowledge that both approaches are necessary, there's significant disagreement about where to focus efforts. Supporters of individual action emphasize personal accountability and the power of collective behavior change, while critics argue that this narrative deflects from the need for policy reform and corporate responsibility. A growing consensus suggests that the most effective approach combines both strategies, with individual actions serving as catalysts for broader systemic changes."
        keyPoints={[
          "Individual actions can create momentum for larger policy changes",
          "Corporate responsibility and government policy are seen as more impactful",
          "The 'both approaches' perspective is gaining traction among participants",
          "Concerns about action paralysis when focusing solely on systemic solutions",
          "Questions about the effectiveness of voluntary vs. mandated changes"
        ]}
        supportingPercentage={45}
        opposingPercentage={32}
        neutralPercentage={23}
        totalOpinions={1832}
        confidence="high"
        lastUpdated="1 hour ago"
        onViewDetails={(id) => console.log('View details for:', id)}
      />
    </div>
  )
}