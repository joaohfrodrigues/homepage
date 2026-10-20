/** An article as a sheet of paper inside the reading window, with a notebook margin. */
export function ArticleSheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-[#e3d4b2] bg-[#fffdf6] py-6 pr-5 pl-6 shadow-[4px_4px_0_#e3d4b2] sm:py-8 sm:pr-8 sm:pl-10">
      <div className="border-l-2 border-[#e7bfb4] pl-4 sm:pl-6">{children}</div>
    </div>
  )
}
